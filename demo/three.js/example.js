import {Simbol} from '../../src/index.js'
import {THREELoader} from '../../src/loaders/three.js'

class Scene {

	constructor(canvas) {
		this.onResize = this.onResize.bind(this)
		this.render = this.render.bind(this)
		this.setUpCanvas(canvas)
	}

	loadProfile(profile) {
		const name = document.querySelector('.profile-name')
		const avatar = document.querySelector('.profile-avatar')
		name.textContent = profile.displayName
		avatar.textContent = profile.avatar
		const loader = new THREELoader(THREE, this.scene, this.camera)
		console.log('here', profile)
	}
	
	setUpCanvas(canvas) {
		this.canvas = canvas
		const width = window.innerWidth
		const height = window.innerHeight
	
		this.scene = new THREE.Scene()
		this.scene.background = new THREE.Color(0xf2f2f2)
		this.camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 100)
		this.camera.position.set(0, 2, 0)
	
		this.renderer = new THREE.WebGLRenderer({
			canvas: canvas,
			antialias: true
		});
		// Last parameter adds pixel units to canvas element
		this.renderer.setSize(width, height, true)
		this.renderer.setPixelRatio(window.devicePixelRatio)
		this.renderer.gammaOutput = true
		this.renderer.gammaFactor = 2.2
		window.addEventListener('resize', this.onResize, false)
	
		const light = new THREE.AmbientLight(0xFFFFFF);
		this.scene.add(light);
	
		this.controls = new THREE.OrbitControls(this.camera, canvas)
		this.controls.minPolarAngle = Math.PI / 2
		this.controls.maxPolarAngle = Math.PI / 2
		this.controls.minZoom = 1
		this.controls.update()
	
		this.render()
	}

	render() {
		this.rAF = requestAnimationFrame(this.render);
		this.renderer.render(this.scene, this.camera);
	}

	onResize() {
		const width = window.innerWidth;
		const height = window.innerHeight;
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();

		this.renderer.setSize(width, height, true);
	}
}

const canvas = document.body.querySelector('.scene')
const button = document.body.querySelector('.register')

const scene = new Scene(canvas)
const simbol = new Simbol()

function register() {
	simbol.requiresRegistration().then((state) => {
		if (state) {
			button.parentElement.classList.remove('hide')
			button.addEventListener('click', simbol.register)
		} else {
			simbol.auth().then((profile) => scene.loadProfile(profile))
		}
	}).catch((e) => console.log('error', e))
}

if (!simbol.isAuthenticated()) {
	register()
} else {
	simbol.getPublicProfile()
		.then((profile) => scene.loadProfile(profile))
		.catch((error) => {
			if (error === 'Invalid access token') {
				register()
			}
		})
}
