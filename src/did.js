class DIDHelper {
	static verifyKeyId(didDoc, keyId) {
		const ldKey = didDoc.publicKey.reduce((returnValue, key) => {
			if (returnValue) {
				return returnValue
			}
			
			if (key.id === keyId) {
				return key
			}
			
			return
		}, undefined)
		if (ldKey.controller !== didDoc.id) {
			throw 'Key is not controlled by the Identity'
		}
		return ldKey.publicKeyPem
	}
}

export {DIDHelper}