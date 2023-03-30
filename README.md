<div align="center">
	<h1>SvelteKit-Session</h1>
	<h3>Simple SvelteKit session management.</h3>
	<a href="https://www.npmjs.com/package/sveltekit-session">
		<img alt="npm license" src="https://img.shields.io/npm/l/sveltekit-session">
	</a>
	<a href="https://www.npmjs.com/package/sveltekit-session">
		<img alt="npm license" src="https://img.shields.io/npm/v/sveltekit-session">
	</a>
	<a href="https://www.npmjs.com/package/sveltekit-session">
		<img alt="GitHub Workflow Status" src="https://img.shields.io/github/actions/workflow/status/mc-0bit/sveltekit-session/main.yml">
	</a>
</div>

<br>

## Installation

```
npm install sveltekit-session
```

`sveltekit-session` offers first class support for redis as a session store. In order to use redis, you need to install `ioredis`.

```
npm install sveltekit-session ioredis
```

## Quickstart

1. Create an instance of `SessionManager`. This example uses the built-in `RedisStore`.

   `/src/lib/server/session.ts`

   ```ts
   import { SessionManager, handleSession } from 'sveltekit-session';
   import RedisStore from 'sveltekit-session/redis';
   import Redis from 'ioredis';

   const redisClient = new Redis({ port: 6379, host: 'localhost' });

   const redisStore = new RedisStore(redisClient); // pass in the redisClient

   //new SessionManager(sessionOptions: SessionOptions, store: Store, cookieOptions?: CookieOptions)
   export const sessionManager = new SessionManager({ ttl: 60 * 60 * 24 * 7, refreshSession: true }, redisStore, { path: '/' });
   ```

   See [SessionManager Options](#sessionmanager-options) for more information.

2. Add the handle hook in `/src/hooks.server.ts`.

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

3. Using SvelteKit-Session is then as simple as this.

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

   	// get a list of all sessionIds
   	await sessionManager.listSessions();

   	// remove specific sessionId from store
   	// THIS WILL NOT DELETE THE COOKIE. USE session.destroy() INSTEAD
   	await sessionManager.deleteSession(sessionId);

   	// remove all sessionIds from store
   	await sessionManager.deleteAllSessions();
   };
   ```

<br>

## Typing your session

Import the `Session` type and add it to the `App.Locals` interface, then pass your type to the `Session` type.

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

<br>

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

<br>

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
// Take a look at the @types/cookie package for more information on CookieSerializeOptions
// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/cookie/index.d.ts#L14
```
