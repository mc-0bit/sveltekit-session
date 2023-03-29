# SvelteKit-Session

Simple SvelteKit session management.

<br>

## Installation

```
npm install sveltekit-session
```

`sveltekit-session` offers first class support for redis as a session store. In order to use redis, you need to install `ioredis`.

```
npm install sveltekit-session ioredis
```

<br>

## Quickstart

`/lib/server/session.ts`

```ts
import { SessionStore, handleSession } from 'sveltekit-session';
import RedisStore from 'sveltekit-session/redis';
import Redis from 'ioredis';

const redisClient = new Redis({ port: 6379, host: 'localhost' });

const redisStore = new RedisStore(redisClient); // pass in the redisClient

//new SessionStore(sessionOptions: SessionOptions, store: Store, cookieOptions?: CookieOptions)
export const sessionStore = new SessionStore({ ttl: 60 * 60 * 24 * 7, refreshSession: true }, redisStore, { path: '/' });
```

Add the handle hook in `/src/hooks.server.ts`.

```ts
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { handleSession } from 'sveltekit-session';
import { sessionStore } from '$lib/server/session';

// your handle hook
export const myHandle = (async ({ event, resolve }) => {
	const session = event.locals.session; // session data is ready to be accessed
	const response = await resolve(event);
	return response;
}) satisfies Handle;

export const handle = sequence(handleSession(sessionStore), myHandle); // make sure to add handleSession before any other hooks that make use of the session
```

Check out the SvelteKit docs on [sequence](https://kit.svelte.dev/docs/modules#sveltejs-kit-hooks-sequence).

<br>

## Using SvelteKit-Session

It's as simple as this.

```ts
import { sessionStore } from '$lib/server/session';

export const load = async (event) => {
	// check if session exists
	if (!event.locals.session) {
		throw error(401, 'Not logged in');
	}

	// create session
	await sessionStore.createSession({ username: 'foo' }, event);

	// use session
	request.locals.session.email = 'bar@baz.com';

	// destroy session
	request.locals.session.destroy();

	// get a list of sessionIds
	await sessionStore.listSessions();

	// remove specific sessionId from store
	// THIS WILL NOT DELETE THE COOKIE. USE session.destroy() INSTEAD
	await sessionStore.destroySession(sessionId);
};
```

<br>

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
}
```
