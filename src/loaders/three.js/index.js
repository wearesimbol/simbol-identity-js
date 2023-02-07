import {createGLTFLoader}  from '../../libs/GLTFLoader.js'
import {createDRACOLoader} from '../../libs/DRACOLoader.js'

class SimbolTHREELoader {

	constructor(THREE, scene, camera) {
		this.THREE = THREE
		this.scene = scene
		this.camera = camera
		this.update = this.update.bind(this)
	}

	loadAvatar(path) {
		return new Promise((resolve, reject) => {
			const loader = createGLTFLoader(this.THREE)
			loader.setDRACOLoader(createDRACOLoader(null, this.THREE))
			console.log(path)
			loader.load('dist/assets/models/avatar.gltf', (model) => {
				this.avatar = model.scene
				this.avatar.name = 'Simbol-Avatar'
				this.scene.add(this.avatar)
				window.avatar = this.avatar
				console.log(path, this.avatar)

				this.headBone = this.avatar.getObjectByName('Head')
				this._attachCamera()
				resolve(this.avatar)
			}, null, reject)
		})
	}

	_attachCamera() {
		const eyeBone = this.avatar.getObjectByName('Eyes')
		avatar.updateMatrixWorld()
		const headPosition = new this.THREE.Vector3()

		if (eyeBone) {
			eyeBone.getWorldPosition(headPosition)
		}
		this._deltaPosition = new this.THREE.Vector3()
		this._deltaPosition.subVectors(headPosition, this.avatar.position)
	}

	update() {
		this.avatar.position.copy(this.camera.position)
		this.avatar.position.sub(this._deltaPosition)
		if (this.headBone) {
			const worldToLocal = new this.THREE.Matrix4();
			worldToLocal.getInverse(this.headBone.parent.matrixWorld)
			const poseMatrix = new this.THREE.Matrix4()
			poseMatrix.makeRotationFromQuaternion(this.camera.quaternion)
			poseMatrix.multiplyMatrices(worldToLocal, poseMatrix)

			const quaternion = new this.THREE.Quaternion()
			poseMatrix.decompose({}, quaternion, {})
			const euler = new this.THREE.Euler()
			euler.setFromQuaternion(quaternion)

			this.headBone.rotation.x = euler.x
			this.headBone.rotation.z = euler.z
		}

		// this.avatar.rotation.y = this.camera.rotation.y
	}
}

export {SimbolTHREELoader}