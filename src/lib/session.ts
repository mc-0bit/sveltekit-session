import type { Handle, RequestEvent, ResolveOptions } from '@sveltejs/kit/types';
import uid from 'uid-safe';
import { isString } from 'lodash';
import { serialize } from 'cookie';
import type { CookieSerializeOptions } from 'cookie';
import type { ReadonlyDeep, Simplify } from 'type-fest';

type MaybePromise<T> = T | Promise<T>;
type ResolveType = (event: RequestEvent, opts?: ResolveOptions) => MaybePromise<Response>;

export interface Store {
	set(key: string, value: any, ttl?: number): Promise<void>;
	get(key: string): Promise<unknown>;
	update(key: string, value: any, ttl?: number): Promise<void>;
	delete(key: string): Promise<void>;
	clear(): Promise<void>;
	keys(): Promise<string[]>;
}

class SvelteKitSession<T> {
	private sessionData: Simplify<T>;
	private sessionId: string;
	private sessionName: string;
	private sessionManager: SessionManager;
	private requestEvent: RequestEvent;

	constructor(data: T, sessionId: string, sessionName: string, sessionManager: SessionManager, requestEvent: RequestEvent) {
		this.sessionData = data;
		this.sessionId = sessionId;
		this.sessionName = sessionName;
		this.sessionManager = sessionManager;
		this.requestEvent = requestEvent;

		return new Proxy(this, {
			set(target: any, name: string, value) {
				if (name === 'data') {
					target.sessionData = value;
					return true;
				}
				target.sessionData[name] = value;
				return true;
			},
			get(target, name) {
				if (typeof target[name] !== 'function') {
					if (name === 'data') {
						return target.sessionData;
					} else if (name === 'id') {
						return target.sessionId;
					}
					return target.sessionData[name];
				} else if (name === 'destroy') {
					return target.destroy.bind(target);
				}
				throw new Error(`Session.${String(name)} is not a property`);
			}
		});
	}

	get data() {
		return this.sessionData;
	}

	set data(value) {}

	get id() {
		return this.sessionId;
	}

	async destroy() {
		await this.sessionManager.deleteSession(this.id, this.requestEvent);
	}
}

export type Session<T> = Simplify<T & SvelteKitSession<T>>;

export type SessionOptions = {
	/**
	 * Number of seconds until the session expires.
	 */
	ttl: number;
	/** @defaultValue `true`
	 * If true, the session will be refreshed on every request.
	 */
	refreshSession?: boolean;
	/** @defaultValue `sessionId`
	 * The name of the session cookie
	 */
	name?: string;
};

export type CookieOptions = Omit<CookieSerializeOptions, 'expires' | 'maxAge'>;

export class SessionManager {
	/**
	 * @param sessionOptions - Session options
	 * @param store - compatible store
	 * @param cookieOptions - cookie options
	 */

	private store: Store;
	private ttl;
	private name;
	private readonly cookieOptions: ReadonlyDeep<CookieSerializeOptions>;
	private refreshSession: boolean;

	constructor(sessionOptions: SessionOptions, store: Store, cookieOptions?: CookieOptions) {
		this.store = store;
		this.ttl = sessionOptions.ttl;
		this.name = sessionOptions.name ?? 'sessionId';
		this.refreshSession = sessionOptions.refreshSession ?? true;
		this.cookieOptions = {
			...{
				maxAge: this.ttl
			},
			...cookieOptions
		};
	}

	/**
	 *
	 * @param cookieOptions
	 * @returns override cookie options for this request
	 */
	private getCookieOptions(cookieOptions?: CookieOptions): CookieSerializeOptions {
		return {
			...this.cookieOptions,
			expires: new Date(Date.now() + this.ttl * 1000),
			...cookieOptions
		};
	}

	/**
	 * **!!!!** - Use `Session.destroy()` if you want to delete the session from the store and destroy the cookie. - **!!!!**
	 *
	 * Deletes the session from the store
	 *
	 * Only pass in `sessionId`
	 * @param sessionId - session id
	 * @param requestEvent - !! Don't pass this !!
	 */
	async deleteSession(sessionId: string, requestEvent?: RequestEvent) {
		await this.store.delete(sessionId);
		if (requestEvent) {
			delete requestEvent.locals.session;
			requestEvent.cookies.delete(this.name, this.getCookieOptions());
		}
	}

	async createSession(session: any, requestEvent: RequestEvent) {
		const sessionId = await uid(24);
		await this.store.set(sessionId, session, this.ttl);

		requestEvent.cookies.set(this.name, sessionId, this.getCookieOptions());

		requestEvent.locals.session = new SvelteKitSession(session, sessionId, this.name, this, requestEvent) as any;
		return requestEvent.locals.session;
	}

	async getSession(cookiesOrSessionId: string | RequestEvent['cookies']) {
		let sessionId;
		if (isString(cookiesOrSessionId)) {
			sessionId = cookiesOrSessionId;
		} else {
			sessionId = cookiesOrSessionId.get(this.name);
			if (!sessionId) return null;
		}
		return await this.store.get(sessionId);
	}

	private async updateSession(sessionId: string, sessionData: SvelteKitSession<any>['data']) {
		await this.store.set(sessionId, sessionData);
		if (this.refreshSession) {
			await this.store.set(sessionId, sessionData, this.ttl);
		} else {
			await this.store.set(sessionId, sessionData);
		}
	}

	private async handleSession(requestEvent: RequestEvent) {
		delete requestEvent.locals.session;

		const cookie = requestEvent.cookies.get(this.name);
		if (!cookie) {
			return;
		}

		const session = await this.getSession(cookie);
		if (!session) {
			requestEvent.cookies.delete(this.name, this.getCookieOptions());
			return;
		}

		requestEvent.locals.session = new SvelteKitSession(session, cookie, this.name, this, requestEvent) as any;
	}

	private async resolve(requestEvent: RequestEvent, resolve: ResolveType) {
		const response = await resolve(requestEvent);
		const session = requestEvent.locals.session;
		const sessionId = requestEvent.cookies.get(this.name);
		if (session && sessionId) {
			await this.updateSession(sessionId, session.data);
			response.headers.append('Set-Cookie', serialize(this.name, sessionId, this.getCookieOptions()));
		}
		return response;
	}

	async listSessions() {
		return await this.store.keys();
	}

	async deleteAllSessions() {
		this.store.clear();
	}
}

export function handleSession(sessionManager: SessionManager) {
	return async function handle({ event, resolve }) {
		// @ts-expect-error - handleSession is private
		await sessionManager.handleSession(event);
		// @ts-expect-error - resolve is private
		const response = await sessionManager.resolve(event, resolve);
		return response;
	} satisfies Handle;
}

export default SessionManager;
