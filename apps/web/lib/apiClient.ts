import { getApiBaseUrl } from './config';

async function request<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
	if (endpoint.startsWith('http')) {
		const res = await fetch(endpoint, {
			cache: 'no-store',
			...options,
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json',
				...options.headers,
			},
		});
		if (!res.ok) {
			const errorText = await res.text().catch(() => '');
			let errorMessage = `HTTP error ${res.status}`;
			try {
				const parsed = JSON.parse(errorText);
				if (parsed.error) errorMessage = parsed.error;
				if (parsed.message) errorMessage = parsed.message;
			} catch {
				if (errorText) errorMessage = errorText;
			}
			throw new Error(errorMessage);
		}
		return res.json() as Promise<T>;
	}

	const base = getApiBaseUrl(); // returns '/api' on client, 'http://localhost:8080/api' on server
	
	let cleanEndpoint = endpoint;
	if (cleanEndpoint.startsWith('/api/')) {
		cleanEndpoint = cleanEndpoint.replace(/^\/api/, '');
	} else if (cleanEndpoint === '/api') {
		cleanEndpoint = '';
	}
	if (!cleanEndpoint.startsWith('/')) {
		cleanEndpoint = '/' + cleanEndpoint;
	}

	const url = `${base}${cleanEndpoint}`;

	const res = await fetch(url, {
		cache: 'no-store',
		...options,
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			...options.headers,
		},
	});

	if (!res.ok) {
		const errorText = await res.text().catch(() => '');
		let errorMessage = `HTTP error ${res.status}`;
		try {
			const parsed = JSON.parse(errorText);
			if (parsed.error) errorMessage = parsed.error;
			if (parsed.message) errorMessage = parsed.message;
		} catch {
			if (errorText) errorMessage = errorText;
		}
		throw new Error(errorMessage);
	}

	return res.json() as Promise<T>;
}

export const apiClient = {
	get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
	post: <T>(endpoint: string, body: any) => request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
	delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

export default apiClient;
