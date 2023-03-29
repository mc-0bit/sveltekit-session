import type { Redis } from 'ioredis';
import type { Store } from './session';

export default class RedisStore implements Store {
	private client: Redis;

	constructor(redisClient: Redis) {
		this.client = redisClient;
	}

	async set(key: string, value: any, ttl?: number) {
		if (ttl) {
			await this.client.set(key, JSON.stringify(value), 'EX', ttl);
		} else {
			await this.client.set(key, JSON.stringify(value));
		}
	}

	async get(key: string): Promise<unknown> {
		const data = await this.client.get(key);
		if (data) {
			return JSON.parse(data);
		}
		return null;
	}

	async update(key: string, value: any, ttl?: number) {
		await this.set(key, value, ttl);
	}

	async delete(key: string) {
		await this.client.del(key);
	}

	async clear() {
		await this.client.flushdb();
	}

	async keys() {
		return await this.client.keys('*');
	}
}
