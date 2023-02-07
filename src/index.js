import {Utils} from './utils.js'
import {DIDHelper} from './did.js'

// const SIMBOL_URL = 'http://localhost:8080'
const SIMBOL_URL = 'https://simbol-identity.surge.sh'

const STATE_LOGGED_OUT = 0
const STATE_AUTHENTICATED = 1

const REGISTER_PARAM = 'identityRequest'
const NONCE_PARAM = 'nonce'
const AUTH_RESPONSE = 'authResponse'
const REFERRER = 'referrer'

const IS_AUTHED = 'isAuthed'
const REGISTER = 'register'
const AUTHENTICATE = 'authenticate'
const LOG_OUT = 'logout'
const GET_PUBLIC_PROFILE = 'getPublicProfile'

const ACCESS_TOKEN_STORE = 'simbol.access-token'
const PUBLIC_PROFILE_STORE = 'simbol.profile.public'

function generateId() {
	const arr = new Uint8Array(20)
	crypto.getRandomValues(arr)
	return Array.from(arr, (num) => {
		return ('0' + num.toString(16)).substr(-2)
	}).join('')
}

class Simbol {

	constructor() {
		this.ready = false
		this.iframe = document.createElement('iframe')
		this.iframe.src = SIMBOL_URL
		this.iframe.style.display = 'none'
		window.addEventListener('load', this._load.bind(this))
		this._awaitLoad = new Promise((resolve) => {
			this._innerAwaitLoad = () => resolve()
		})

		this._setupMessageListener()

		this.actionCallbacks = {}

		this.register = this.register.bind(this)
		this.auth = this.auth.bind(this)
	}

	register() {
		if (!this._requiresRegistration) {
			return
		}
		const challenge = this._generateChallenge()
		window.location = `${SIMBOL_URL}/?${REGISTER_PARAM}=${challenge.challenge}&${NONCE_PARAM}=${challenge.nonce}&${REFERRER}=${encodeURIComponent(window.location.origin)}`
	}
	
	async auth() {
		await this._awaitLoad
		if (this._handlingAuth) {
			return this._handlingAuth
		}
		return new Promise((resolve) => {
			const challenge = this._generateChallenge()
			this._sendMessage({
				action: AUTHENTICATE,
				data: challenge
			}, (authResponse) => {
				resolve(this._handleAuthResponse(authResponse))
			})
		})
	}

	_getAuthResponse() {
		const urlParams = new URLSearchParams(window.location.search)
		try {
			const authResponse = JSON.parse(decodeURIComponent(urlParams.get(AUTH_RESPONSE)))
			if (authResponse) {
				this._handlingAuth = this._handleAuthResponse(authResponse)
					.then((publicProfile) => {
						const baseOrigin = window.location.href.replace(window.location.search, '')
						window.history.replaceState('', document.title, baseOrigin)

						return publicProfile
					})
			}
		} catch (e) {
			console.error(e)
		}
	}

	async _handleAuthResponse(authResponse) {
		if (authResponse) {
			console.log('auth', authResponse)
			const nonce = localStorage.getItem('nonce')

			if (nonce !== authResponse.nonce) {
				throw 'Returned nonce is not the same'
			}

			const key = DIDHelper.verifyKeyId(authResponse.didDoc, authResponse.key)

			const isValid = await this._isValidChallenge(key, authResponse.challenge)

			localStorage.setItem(ACCESS_TOKEN_STORE, authResponse.accessToken)
			localStorage.removeItem('nonce')
			localStorage.removeItem('challenge')

			if (isValid) {
				const publicProfile = await this.getPublicProfile()
				return publicProfile
			} else {
				throw 'Failed authentication process' 
			}
		}
	}

	requiresRegistration() {
		if (typeof this._requiresRegistration !== 'undefined') {
			console.log('resolving early')
			return Promise.resolve(this._requiresRegistration)
		}
		return new Promise((resolve) => {
			this._awaitRegistrationStatus = (status) => {
				resolve(status)
			}
		})
	}

	async getPublicProfile() {
		await this._awaitLoad
		if (this.isAuthenticated()) {
			if (this.publicProfile) {
				return Promise.resolve(this.publicProfile)
			} else {
				try {
					const localPublicProfile = this._getLocalPublicProfile()
					return Promise.resolve(localPublicProfile)
				} catch (e) {
					return this._refreshPublicProfile()
				}
				
			}
		} else {
			'The person needs to be authenticated before retrieving the public profile'
		}
	}

	_getLocalPublicProfile() {
		const publicProfileString = localStorage.getItem(PUBLIC_PROFILE_STORE)
		try {
			const publicProfile = JSON.parse(publicProfileString)
			if (!publicProfile) {
				localStorage.removeItem(PUBLIC_PROFILE_STORE)
				throw 'Saved profile is invalid'
			}
			return publicProfile
		} catch (e) {
			throw `Can't load public profile ${publicProfileString}`
		}
	}

	_refreshPublicProfile() {
		return new Promise((resolve, reject) => {
			this._sendMessage({
				action: GET_PUBLIC_PROFILE,
				token: this.getAccessToken()
			}, (publicProfile) => {
				if (!publicProfile) {
					reject(`Can't load public profile`)
				} else if (publicProfile.error === 'Invalid access token') {
					localStorage.removeItem(ACCESS_TOKEN_STORE)
					reject(`Invalid access token`)
				} else {
					localStorage.setItem(PUBLIC_PROFILE_STORE, JSON.stringify(publicProfile))
					resolve(publicProfile)
				}
			})
		})
	}

	getAccessToken() {
		this.accessToken = this.accessToken || localStorage.getItem(ACCESS_TOKEN_STORE)
		return this.accessToken
	}

	isAuthenticated() {
		return !!localStorage.getItem(ACCESS_TOKEN_STORE)
	}

	logout() {
		localStorage.removeItem(ACCESS_TOKEN_STORE)
		localStorage.removeItem(PUBLIC_PROFILE_STORE)
	}

	_generateChallenge() {
		const challenge = generateId()
		const nonce = generateId()
		localStorage.setItem('challenge', challenge)
		localStorage.setItem('nonce', nonce)
		return {
			challenge,
			nonce
		}
	}

	async _isValidChallenge(key, signedChallenge) {			
		const challenge = localStorage.getItem('challenge')
		return Utils.verify(key, signedChallenge, challenge)
	}

	_setRegistrationState(state) {
		this._requiresRegistration = state
		if (this._awaitRegistrationStatus) {
			this._awaitRegistrationStatus(this._requiresRegistration)
		}
	}

	_load() {
		window.document.body.append(this.iframe)
		this.iframe.addEventListener('load', () => {
			this._innerAwaitLoad()
		})
	}

	_setupMessageListener() {
		window.addEventListener('message', (event) => {
			if (event.origin !== SIMBOL_URL) {
				return
			}

			const data = JSON.parse(event.data)
			if (typeof data.state !== 'undefined') {
				switch(data.state) {
					case STATE_LOGGED_OUT:
						this._setRegistrationState(true)
						break
					case STATE_AUTHENTICATED:
						this._setRegistrationState(false)
						this._getAuthResponse()
						break
					default:
						console.log('app state', data.state)
				}
				return
			}

			if (data.action) {
				switch(data.action) {
					case IS_AUTHED:
					case REGISTER:
					case AUTHENTICATE:
						this.actionCallbacks[AUTHENTICATE](data.data)
						delete this.actionCallbacks[AUTHENTICATE]
						break
					case LOG_OUT:
						break
					case GET_PUBLIC_PROFILE:
						this.publicProfile = data.data
						this.actionCallbacks[GET_PUBLIC_PROFILE](data.data)
						delete this.actionCallbacks[GET_PUBLIC_PROFILE]
						break
					default:
						console.log('app', data)
				}
			}
		}, false)
	}

	_sendMessage(message, callback) {
		const action = message.action
		this.actionCallbacks[action] = callback
		message = JSON.stringify(message)
		console.log('app sending', message)
		this.iframe.contentWindow.postMessage(message, SIMBOL_URL)
	}
}

export {Simbol}