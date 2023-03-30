# SvelteKit-Session

Simple SvelteKit session management.

## Installation

```
npm install sveltekit-session
```

`sveltekit-session` offers first class support for redis as a session store. In order to use redis, you need to install `ioredis`.

```
npm install sveltekit-session ioredis
```

## Quickstart

`/lib/server/session.ts`

```ts
import { SessionManager, handleSession } from 'sveltekit-session';
import RedisStore from 'sveltekit-session/redis';
import Redis from 'ioredis';

const redisClient = new Redis({ port: 6379, host: 'localhost' });

const redisStore = new RedisStore(redisClient); // pass in the redisClient

//new SessionManager(sessionOptions: SessionOptions, store: Store, cookieOptions?: CookieOptions)
export const sessionManager = new SessionManager({ ttl: 60 * 60 * 24 * 7, refreshSession: true }, redisStore, { path: '/' });
```

See [SessionManager Options](#sessionmanager-options) for more information on the options.

Add the handle hook in `/src/hooks.server.ts`.

```ts
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { handleSession } from 'sveltekit-session';
import { sessionManager } from '$lib/server/session';

// your handle hook
export const myHandle = (async ({ event, resolve }) => {
	const session = event.locals.session; // session data is ready to be accessed
	const response = await resolve(event);
	return response;
}) satisfies Handle;

export const handle = sequence(handleSession(sessionManager), myHandle); // make sure to add handleSession before any other hooks that make use of the session
```

Check out the SvelteKit docs on [sequence](https://kit.svelte.dev/docs/modules#sveltejs-kit-hooks-sequence).

## Using SvelteKit-Session

It's as simple as this.

```ts
import { sessionManager } from '$lib/server/session';

export const load = async (event) => {
	// check if session exists
	if (!event.locals.session) {
		throw error(401, 'Not logged in');
	}

	// create session
	await sessionManager.createSession({ username: 'foo' }, event);

	// use session
	request.locals.session.email = 'bar@baz.com';

	// destroy session
	request.locals.session.destroy();

	// get a list of sessionIds
	await sessionManager.listSessions();

	// remove specific sessionId from store
	// THIS WILL NOT DELETE THE COOKIE. USE session.destroy() INSTEAD
	await sessionManager.deleteSession(sessionId);

	// remove all sessionIds from store
	await sessionManager.deleteAllSessions();
};
```

## Typing your session

Create a `Session` type with your own properties.

`/src/app.d.ts`

```ts
type MySessionData = {
	username: string;
	email?: string;
};

declare namespace App {
	interface Locals {
		session?: import('sveltekit-session').Session<MySessionData>;
	}
}
```

## Custom stores

Custom stores can be easily created by implementing the `Store` interface.

Check out the [RedisStore](https://github.com/mc-0bit/sveltekit-session/tree/main/src/lib/redis.ts) for an example.

```ts
interface Store {
	set(key: string, value: any, ttl?: number): Promise<void>;
	get(key: string): Promise<unknown>;
	update(key: string, value: any, ttl?: number): Promise<void>;
	delete(key: string): Promise<void>;
	clear(): Promise<void>;
	keys(): Promise<string[]>;
}
```

## SessionManager options

```ts
type SessionOptions = {
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

type CookieOptions = Omit<CookieSerializeOptions, 'expires' | 'maxAge'>; // expires and maxAge are automatically set based on the ttl
// Check out the @types/cookie package for more information on CookieSerializeOptions
// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/cookie/index.d.ts#L14
```
