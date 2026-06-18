export interface AuthSession {
	accessToken: string;
	accountName: string;
	authType: 'pat' | 'oauth';
	expiresAt?: number;
	refreshToken?: string;
}

export interface AuthProvider {
	signIn(): Promise<AuthSession>;
	signOut(): Promise<void>;
	getSession(): Promise<AuthSession | undefined>;
}
