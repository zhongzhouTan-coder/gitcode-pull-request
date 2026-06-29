import * as assert from 'assert';
import { mapUser } from '../gitcode/mappers/userMapper';

suite('UserMapper', () => {
	test('prefers nick_name as display name for repository members', () => {
		const user = mapUser({
			login: 'alice',
			username: 'alice',
			name: 'Alice Legal Name',
			nick_name: 'Alice',
			web_url: 'https://gitcode.com/alice',
		});

		assert.strictEqual(user.login, 'alice');
		assert.strictEqual(user.name, 'Alice');
		assert.strictEqual(user.htmlUrl, 'https://gitcode.com/alice');
	});
});
