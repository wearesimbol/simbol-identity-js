class Utils {

	static toBase64(u8) {
		return btoa(String.fromCharCode.apply(null, u8))
	}
	
	static fromBase64(str) {
		return Uint8Array.from(atob(str).split('').map((c) => {
			return c.charCodeAt(0)
		}))
	}

	static stringToBuffer(str) {
		Utils.encoder = Utils.encoder || new TextEncoder()
		return Utils.encoder.encode(str)
	}

	static async verify(keyString, signature, string) {
		try {
			const publicKey = await Utils.importPublicKey(Utils.fromBase64(keyString))
			const isValid = await crypto.subtle.verify(
				{name: 'RSASSA-PKCS1-v1_5'},
				publicKey,
				Utils.fromBase64(signature),
				Utils.stringToBuffer(string)
			)
			return isValid
		} catch (error) {
			throw error
		}
	}

	static importPublicKey(key) {
		return crypto.subtle.importKey(
			'spki',
			key,
			{
				name: 'RSASSA-PKCS1-v1_5',
				hash: {name: 'SHA-256'},
			},
			false,
			['verify']
		)
	}
}

export {Utils}