import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import headObjUrl from "./models/head.obj?url";
import homerObjUrl from "./models/homer.obj?url";
import eightObjUrl from "./models/eight.obj?url";
import headVectorsUrl from "./models/head_vectors.mhb?url";
import homerVectorsUrl from "./models/homer_vectors.mhb?url";
import eightVectorsUrl from "./models/eight_vectors.mhb?url";
import sampleAudioUrl from "./audio/test.mp3?url";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const NUM_HARMONICS = 50;

const MODEL_OBJ_URLS = {
	head: headObjUrl,
	homer: homerObjUrl,
	eight: eightObjUrl
};

const MODEL_MHB_VECTOR_URLS = {
	head: headVectorsUrl,
	homer: homerVectorsUrl,
	eight: eightVectorsUrl
};

const LEGACY_MANIFOLD_VERTEX_SHADER = `
uniform sampler2D uMHB;
uniform sampler2D uCoeff;
uniform sampler2D uFilter;
uniform sampler2D uDiff;

uniform int uNumVertices;
uniform int uMHBTexSize;
uniform int uCoeffTexSize;
uniform int uDiffTexSize;
uniform vec3 uModelCenter;

varying vec3 transNormal;
varying vec3 eyeVec;

vec2 texCoordVertexData(float texSize, float vIndex) {
	float x = floor(vIndex / texSize);
	float y = mod(vIndex, texSize);
	return vec2((y + 0.5) / texSize, (x + 0.5) / texSize);
}

vec2 texCoordRGBAData(float texSize, float index) {
	float texelIndex = floor(index / 4.0);
	float x = floor(texelIndex / texSize);
	float y = mod(texelIndex, texSize);
	return vec2((y + 0.5) / texSize, (x + 0.5) / texSize);
}

void main() {
	vec3 recPos = vec3(0.0, 0.0, 0.0);
	float vertexIndex = position.x;

	for (int k = 0; k < 50; ++k) {
		float mhbIndex = float(k) * float(uNumVertices) + vertexIndex;
		vec2 mhbCoords = texCoordRGBAData(float(uMHBTexSize), mhbIndex);
		vec4 mhbTexel = texture2D(uMHB, mhbCoords);

		vec2 freqCoords = texCoordVertexData(float(uCoeffTexSize), float(k));
		vec3 coeffs = texture2D(uCoeff, freqCoords).xyz;
		vec3 filterValue = texture2D(uFilter, freqCoords).xyz;

		float mhbValue;
		int mhbCoord = int(mod(mhbIndex, 4.0));
		if (mhbCoord == 0) mhbValue = mhbTexel[0];
		else if (mhbCoord == 1) mhbValue = mhbTexel[1];
		else if (mhbCoord == 2) mhbValue = mhbTexel[2];
		else mhbValue = mhbTexel[3];

		recPos = recPos + (coeffs * filterValue * vec3(mhbValue));
	}

	vec2 diffCoords = texCoordVertexData(float(uDiffTexSize), vertexIndex);
	vec3 diffVec = texture2D(uDiff, diffCoords).xyz;
	vec3 centeredPos = recPos + diffVec - uModelCenter;

	transNormal = normalMatrix * normal;
	eyeVec = -vec3(modelViewMatrix * vec4(centeredPos, 1.0));
	gl_Position = projectionMatrix * vec4(-eyeVec, 1.0);
}
`;

const LEGACY_MANIFOLD_FRAGMENT_SHADER = `
uniform vec3 uAmbientColor;
uniform vec3 uLightingDirection;
uniform vec3 uDirectionalColor;
uniform vec3 uMatColor;
uniform vec3 uMatSpecularColor;

varying vec3 transNormal;
varying vec3 eyeVec;

void main(void) {
	vec3 color = uMatColor;
	float lambert = dot(normalize(transNormal), normalize(uLightingDirection));

	if (lambert > 0.0) {
		vec3 reflection = reflect(-normalize(uLightingDirection), normalize(transNormal));
		float specular = pow(max(dot(normalize(reflection), normalize(eyeVec)), 0.0), 15.0);
		color += uDirectionalColor * lambert + uMatSpecularColor * specular;
	}

	gl_FragColor = vec4(color, 1.0);
}
`;

const BG_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const BG_FRAGMENT_SHADER = `
varying vec2 vUv;
uniform float uTime;
uniform float uAudioLow;
uniform float uAudioMid;
uniform float uAudioHigh;

float hash(vec2 p) {
	p = fract(p * vec2(127.1, 311.7));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
		mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
		f.y
	);
}

float fbm(vec2 p) {
	float v = 0.0;
	float amp = 0.5;
	for (int i = 0; i < 5; i++) {
		v += noise(p) * amp;
		p = p * 2.1 + vec2(1.7, 9.2);
		amp *= 0.5;
	}
	return v;
}

void main() {
	float t = uTime * 0.07;
	vec2 uv = vUv;

	float n1 = fbm(uv * 3.0 + vec2(t, t * 0.6));
	float n2 = fbm(uv * 5.0 - vec2(t * 0.5, t * 0.9) + vec2(n1 * 0.5));
	float n3 = fbm(uv * 2.5 + vec2(n2 * 0.4) + vec2(-t * 0.3, t * 0.4));

	vec3 dark   = vec3(0.01, 0.008, 0.04);
	vec3 purple = vec3(0.16, 0.03, 0.32);
	vec3 blue   = vec3(0.02, 0.06, 0.28);
	vec3 pink   = vec3(0.30, 0.04, 0.20);

	vec3 col = dark;
	col = mix(col, purple, smoothstep(0.3, 0.8, n1 * n3));
	col = mix(col, blue,   smoothstep(0.4, 0.9, n2 * n1));
	col += pink * n3 * n1 * 0.6;

	col += purple * uAudioLow  * 0.8 * smoothstep(0.5, 1.0, n3);
	col += blue   * uAudioMid  * 0.5 * smoothstep(0.4, 1.0, n1);
	col += vec3(0.4, 0.15, 0.5) * uAudioHigh * 0.3 * n2;

	gl_FragColor = vec4(col, 1.0);
}
`;

const PARTICLE_VERTEX_SHADER = `
attribute float aRandom;
uniform float uTime;
uniform float uAudioLow;
uniform float uAudioHigh;
uniform float uPixelRatio;

varying float vRandom;
varying float vBrightness;

void main() {
	vRandom = aRandom;

	float t = uTime * (0.08 + aRandom * 0.12);
	float orbitAngle = aRandom * 6.28318 + t;
	float xzRadius = length(position.xz);

	vec3 pos = position;
	pos.x += sin(orbitAngle) * 0.12 * xzRadius;
	pos.y += cos(uTime * 0.15 + aRandom * 6.28318) * 0.18;
	pos.z += cos(orbitAngle) * 0.12 * xzRadius;

	vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
	float audioExpand = 1.0 + uAudioLow * 2.5 * (0.5 + aRandom * 0.5);
	float sz = (1.5 + aRandom * 3.5) * audioExpand * uPixelRatio * (280.0 / -mvPos.z);
	gl_PointSize = clamp(sz, 1.0, 20.0);

	vBrightness = 0.4 + uAudioHigh * 0.6 * aRandom;
	gl_Position = projectionMatrix * mvPos;
}
`;

const PARTICLE_FRAGMENT_SHADER = `
varying float vRandom;
varying float vBrightness;
uniform float uTheme;

void main() {
	vec2 uv = gl_PointCoord - 0.5;
	float d = length(uv);
	if (d > 0.5) discard;

	float alpha = (1.0 - d * 2.0);
	alpha = alpha * alpha * vBrightness;

	vec3 darkCol1  = vec3(0.85, 0.35, 1.0);
	vec3 darkCol2  = vec3(0.15, 0.65, 1.0);
	vec3 lightCol1 = vec3(0.04, 0.22, 0.82);
	vec3 lightCol2 = vec3(0.02, 0.50, 0.42);
	vec3 col1 = mix(lightCol1, darkCol1, uTheme);
	vec3 col2 = mix(lightCol2, darkCol2, uTheme);

	gl_FragColor = vec4(mix(col1, col2, vRandom), alpha);
}
`;

class ModernMusicVisApp {
	constructor() {
		this.container = document.getElementById("container");
		this.errorConsole = document.getElementById("errorConsole");
		this.playButton = document.getElementById("btnPlay");
		this.stopButton = document.getElementById("btnStop");
		this.modelSelect = document.getElementById("selModel");
		this.modeSelect = document.getElementById("selMode");
		this.gainSlider = document.getElementById("gainSlider");
		this.themeToggleButton = document.getElementById("themeToggle");

		this.renderer = null;
		this.scene = null;
		this.camera = null;
		this.controls = null;

		this.mesh = null;
		this.basePositions = null;
		this.baseNormals = null;
		this.legacyState = null;
		this.currentModelName = this.modelSelect ? this.modelSelect.value : "head";
		this.modelLoadToken = 0;

		this.audioContext = null;
		this.analyser = null;
		this.frequencyData = null;
		this.audioBuffer = null;
		this.sourceNode = null;
		this.isPlaying = false;

		this.gainHighFreq = Number(this.gainSlider.value || 3);
		this.deformationMode = this.modeSelect ? this.modeSelect.value : "manifold";

		this.composer = null;
		this.bloomPass = null;
		this.bgMesh = null;
		this.particles = null;
		this.ambientLight = null;
		this.keyLight = null;
		this.rimLight = null;
		this.audioLow = 0;
		this.audioMid = 0;
		this.audioHigh = 0;
	}

	applyTheme(theme) {
		document.documentElement.setAttribute("data-theme", theme);
		document.body.classList.toggle("theme-dark", theme === "dark");
		document.body.classList.toggle("theme-light", theme !== "dark");
		if (this.themeToggleButton) {
			this.themeToggleButton.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
			this.themeToggleButton.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
		}
		this.updateSceneTheme(theme);
	}

	setDeformationMode(mode) {
		if (mode === "procedural" || mode === "manifold") {
			this.deformationMode = mode;
		}
	}

	calcPow2TexSize(numberOfTexels) {
		return Math.pow(2, Math.ceil(Math.log(Math.ceil(Math.sqrt(numberOfTexels))) / Math.log(2)));
	}

	createFloatDataTexture(data, width, height, format = THREE.RGBAFormat) {
		const texture = new THREE.DataTexture(data, width, height, format, THREE.FloatType);
		texture.minFilter = THREE.NearestFilter;
		texture.magFilter = THREE.NearestFilter;
		texture.wrapS = THREE.ClampToEdgeWrapping;
		texture.wrapT = THREE.ClampToEdgeWrapping;
		texture.generateMipmaps = false;
		texture.needsUpdate = true;
		return texture;
	}

	updateSceneTheme(theme) {
		if (this.renderer) {
			if (theme === "dark") {
				this.renderer.setClearColor(0x090e1a, 1);
			} else {
				this.renderer.setClearColor(0xe8edf5, 1);
			}
		}

		if (this.ambientLight && this.keyLight && this.rimLight) {
			if (theme === "dark") {
				this.ambientLight.color.setHex(0x101522);
				this.ambientLight.intensity = 0.18;
				this.keyLight.color.setHex(0xffc1dc);
				this.keyLight.intensity = 0.7;
				this.rimLight.color.setHex(0x6f8cff);
				this.rimLight.intensity = 0.22;
			} else {
				this.ambientLight.color.setHex(0xffffff);
				this.ambientLight.intensity = 0.55;
				this.keyLight.color.setHex(0xffffff);
				this.keyLight.intensity = 1.0;
				this.rimLight.color.setHex(0x88aaff);
				this.rimLight.intensity = 0.3;
			}
		}

		if (this.bgMesh) {
			this.bgMesh.visible = (theme === "dark");
		}
		if (this.particles) {
			this.particles.visible = true;
			const isDark = theme === "dark";
			this.particles.material.uniforms.uTheme.value = isDark ? 1.0 : 0.0;
			this.particles.material.blending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
		}
		if (this.bloomPass) {
			if (theme === "dark") {
				this.bloomPass.enabled   = true;
				this.bloomPass.strength  = 0.35;
				this.bloomPass.radius    = 0.35;
				this.bloomPass.threshold = 0.92;
			} else {
				this.bloomPass.enabled = false;
			}
		}

		if (this.mesh && this.mesh.material) {
			if (this.mesh.material.isShaderMaterial && this.mesh.material.uniforms) {
				if (theme === "dark") {
					this.mesh.material.uniforms.uMatColor.value.set(1.0, 0.45, 0.73);
					this.mesh.material.uniforms.uDirectionalColor.value.set(0.28, 0.2, 0.32);
					this.mesh.material.uniforms.uAmbientColor.value.set(0.02, 0.02, 0.035);
					this.mesh.material.uniforms.uMatSpecularColor.value.set(0.16, 0.12, 0.18);
				} else {
					this.mesh.material.uniforms.uMatColor.value.set(0.2, 0.62, 1.0);
					this.mesh.material.uniforms.uDirectionalColor.value.set(0.22, 0.45, 0.4);
					this.mesh.material.uniforms.uAmbientColor.value.set(0.1, 0.1, 0.1);
					this.mesh.material.uniforms.uMatSpecularColor.value.set(0.3, 0.6, 0.5);
				}
			} else if (this.mesh.material.color && this.mesh.material.emissive) {
				if (theme === "dark") {
					this.mesh.material.color.setHex(0xff67b5);
					this.mesh.material.emissive.setHex(0x12040e);
					this.mesh.material.roughness = 0.52;
					this.mesh.material.metalness = 0.08;
				} else {
					this.mesh.material.color.setHex(0x2c9bff);
					this.mesh.material.emissive.setHex(0x000000);
					this.mesh.material.roughness = 0.35;
					this.mesh.material.metalness = 0.15;
				}
			}
		}
	}

	initTheme() {
		const storedTheme = localStorage.getItem("musicvis-theme");
		const systemPrefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
		const initialTheme = storedTheme || (systemPrefersDark ? "dark" : "light");
		this.applyTheme(initialTheme);
	}

	setError(message) {
		if (this.errorConsole) {
			this.errorConsole.textContent = message || "";
		}
	}

	setButtons(playEnabled, stopEnabled) {
		this.playButton.disabled = !playEnabled;
		this.stopButton.disabled = !stopEnabled;
	}

	initRenderer() {
		this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
		this.renderer.setPixelRatio(window.devicePixelRatio || 1);
		this.renderer.setClearColor(0xe8edf5, 1);
		this.renderer.domElement.style.display = "block";
		this.renderer.domElement.style.width = "100%";
		this.renderer.domElement.style.height = "100%";
		this.container.innerHTML = "";
		this.container.appendChild(this.renderer.domElement);

		this.scene = new THREE.Scene();

		const width = this.container.clientWidth || 1000;
		const height = this.container.clientHeight || 600;
		this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
		this.camera.position.set(0, 0, 4);

		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.08;
		this.controls.target.set(0, 0, 0);

		this.ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
		this.keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
		this.keyLight.position.set(3, 2, 4);
		this.rimLight = new THREE.DirectionalLight(0x88aaff, 0.3);
		this.rimLight.position.set(-4, -1, -3);
		this.scene.add(this.ambientLight, this.keyLight, this.rimLight);

		this.initBackground();
		this.initParticles();

		const renderPass = new RenderPass(this.scene, this.camera);
		const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.6, 0.5, 0.82);
		this.bloomPass = bloomPass;
		this.composer = new EffectComposer(this.renderer);
		this.composer.addPass(renderPass);
		this.composer.addPass(bloomPass);

		this.onResize();
		window.addEventListener("resize", () => this.onResize());
	}

	onResize() {
		const width = Math.max(1, this.container.clientWidth || 1000);
		const height = Math.max(1, this.container.clientHeight || 600);
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(width, height, true);
		this.renderer.setViewport(0, 0, width, height);
		this.renderer.setScissor(0, 0, width, height);
		this.renderer.setScissorTest(false);
		if (this.composer) {
			this.composer.setSize(width, height);
		}
	}

	initBackground() {
		const bgGeo = new THREE.SphereGeometry(100, 32, 32);
		const bgMat = new THREE.ShaderMaterial({
			side: THREE.BackSide,
			depthWrite: false,
			uniforms: {
				uTime: { value: 0 },
				uAudioLow: { value: 0 },
				uAudioMid: { value: 0 },
				uAudioHigh: { value: 0 }
			},
			vertexShader: BG_VERTEX_SHADER,
			fragmentShader: BG_FRAGMENT_SHADER
		});
		this.bgMesh = new THREE.Mesh(bgGeo, bgMat);
		this.bgMesh.visible = false;
		this.scene.add(this.bgMesh);
	}

	initParticles() {
		const COUNT = 2500;
		const positions = new Float32Array(COUNT * 3);
		const randoms = new Float32Array(COUNT);
		for (let i = 0; i < COUNT; i++) {
			const phi = Math.random() * Math.PI * 2;
			const cosTheta = 2 * Math.random() - 1;
			const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
			const r = 1.8 + Math.random() * 3.5;
			positions[i * 3]     = r * sinTheta * Math.cos(phi);
			positions[i * 3 + 1] = r * cosTheta;
			positions[i * 3 + 2] = r * sinTheta * Math.sin(phi);
			randoms[i] = Math.random();
		}
		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		geo.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));
		const mat = new THREE.ShaderMaterial({
			uniforms: {
				uTime: { value: 0 },
				uAudioLow: { value: 0 },
				uAudioHigh: { value: 0 },
				uPixelRatio: { value: window.devicePixelRatio || 1 },
				uTheme: { value: 1.0 }
			},
			vertexShader: PARTICLE_VERTEX_SHADER,
			fragmentShader: PARTICLE_FRAGMENT_SHADER,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending
		});
		this.particles = new THREE.Points(geo, mat);
		this.particles.visible = false;
		this.scene.add(this.particles);
	}

	createGeometryByName(name) {
		let geometry;
		if (name === "head") {
			geometry = new THREE.SphereGeometry(1.15, 96, 64);
		} else if (name === "homer") {
			geometry = new THREE.TorusKnotGeometry(0.75, 0.26, 260, 32, 2, 3);
		} else {
			geometry = new THREE.IcosahedronGeometry(1.15, 5);
		}

		const nonIndexed = geometry.toNonIndexed();
		nonIndexed.computeVertexNormals();
		return nonIndexed;
	}

	cleanupCurrentMesh() {
		if (!this.mesh) {
			this.legacyState = null;
			return;
		}

		this.scene.remove(this.mesh);

		if (this.mesh.material && this.mesh.material.isShaderMaterial && this.mesh.material.uniforms) {
			const uniforms = this.mesh.material.uniforms;
			["uMHB", "uCoeff", "uFilter", "uDiff"].forEach((key) => {
				if (uniforms[key] && uniforms[key].value && uniforms[key].value.dispose) {
					uniforms[key].value.dispose();
				}
			});
		}

		if (this.mesh.geometry) {
			this.mesh.geometry.dispose();
		}
		if (this.mesh.material) {
			this.mesh.material.dispose();
		}

		this.mesh = null;
		this.basePositions = null;
		this.baseNormals = null;
		this.legacyState = null;
	}

	setProceduralModel(name) {
		this.cleanupCurrentMesh();

		const geometry = this.createGeometryByName(name);
		const material = new THREE.MeshStandardMaterial({
			color: 0x2c9bff,
			roughness: 0.35,
			metalness: 0.15,
			flatShading: false
		});

		this.mesh = new THREE.Mesh(geometry, material);
		this.scene.add(this.mesh);

		this.basePositions = new Float32Array(geometry.attributes.position.array);
		this.baseNormals = new Float32Array(geometry.attributes.normal.array);

		this.camera.position.set(0, 0, 4);
		this.controls.target.set(0, 0, 0);
		this.controls.update();
		this.updateSceneTheme(document.documentElement.getAttribute("data-theme") || "light");
	}

	async loadObjGeometry(name) {
		const objUrl = MODEL_OBJ_URLS[name];
		if (!objUrl) {
			throw new Error(`No OBJ asset mapping found for model ${name}.`);
		}

		const response = await fetch(objUrl);
		if (!response.ok) {
			throw new Error(`Could not load OBJ model ${name} (${response.status}).`);
		}
		const objText = await response.text();
		const lines = objText.split(/\r?\n/);
		const vertices = [];
		const indices = [];

		const toZeroBasedVertexIndex = (token) => {
			const first = token.split("/")[0];
			const value = Number(first);
			if (!Number.isFinite(value) || value === 0) {
				return null;
			}
			return value > 0 ? value - 1 : vertices.length / 3 + value;
		};

		for (let i = 0; i < lines.length; i += 1) {
			const line = lines[i].trim();
			if (!line || line.startsWith("#")) {
				continue;
			}

			if (line.startsWith("v ")) {
				const parts = line.split(/\s+/);
				if (parts.length >= 4) {
					vertices.push(Number(parts[1]), Number(parts[2]), Number(parts[3]));
				}
				continue;
			}

			if (line.startsWith("f ")) {
				const faceParts = line.split(/\s+/).slice(1);
				if (faceParts.length < 3) {
					continue;
				}

				const faceIndices = [];
				for (let j = 0; j < faceParts.length; j += 1) {
					const idx = toZeroBasedVertexIndex(faceParts[j]);
					if (idx !== null) {
						faceIndices.push(idx);
					}
				}

				for (let j = 1; j < faceIndices.length - 1; j += 1) {
					indices.push(faceIndices[0], faceIndices[j], faceIndices[j + 1]);
				}
			}
		}

		if (vertices.length === 0 || indices.length === 0) {
			throw new Error(`Could not parse mesh data from OBJ model ${name}.`);
		}

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
		geometry.setIndex(indices);
		geometry.computeVertexNormals();
		return geometry;
	}

	async loadMhbVectors(name) {
		const mhbUrl = MODEL_MHB_VECTOR_URLS[name];
		if (!mhbUrl) {
			throw new Error(`No MHB asset mapping found for model ${name}.`);
		}

		const response = await fetch(mhbUrl);
		if (!response.ok) {
			throw new Error(`Could not load manifold harmonics vectors for ${name} (${response.status}).`);
		}
		const buffer = await response.arrayBuffer();
		return new Float32Array(buffer);
	}

	buildLegacyTextures(basePositions, mhbValues) {
		const numVertices = basePositions.length / 3;
		const requiredMhbLength = numVertices * NUM_HARMONICS;
		if (mhbValues.length < requiredMhbLength) {
			const availableVertices = Math.floor(mhbValues.length / NUM_HARMONICS);
			throw new Error(
				`MHB data does not contain enough values for this model (model vertices: ${numVertices}, MHB vertices: ${availableVertices}, harmonics: ${NUM_HARMONICS}).`
			);
		}

		const mhbTexSize = this.calcPow2TexSize(Math.ceil(requiredMhbLength / 4));
		const mhbBuffer = new Float32Array(mhbTexSize * mhbTexSize * 4);
		mhbBuffer.set(mhbValues.subarray(0, requiredMhbLength));
		const mhbTexture = this.createFloatDataTexture(mhbBuffer, mhbTexSize, mhbTexSize, THREE.RGBAFormat);

		const coeffTexSize = this.calcPow2TexSize(NUM_HARMONICS);
		const coeffBuffer = new Float32Array(coeffTexSize * coeffTexSize * 4);
		for (let i = 0; i < numVertices; i += 1) {
			for (let k = 0; k < NUM_HARMONICS; k += 1) {
				const mhbValue = mhbValues[k * numVertices + i];
				const vertexBase = i * 3;
				const coeffBase = k * 4;
				coeffBuffer[coeffBase] += basePositions[vertexBase] * mhbValue;
				coeffBuffer[coeffBase + 1] += basePositions[vertexBase + 1] * mhbValue;
				coeffBuffer[coeffBase + 2] += basePositions[vertexBase + 2] * mhbValue;
			}
		}
		const coeffTexture = this.createFloatDataTexture(coeffBuffer, coeffTexSize, coeffTexSize, THREE.RGBAFormat);

		const reconstructed = new Float32Array(numVertices * 3);
		for (let i = 0; i < numVertices; i += 1) {
			for (let k = 0; k < NUM_HARMONICS; k += 1) {
				const mhbValue = mhbValues[k * numVertices + i];
				const coeffBase = k * 4;
				const recBase = i * 3;
				reconstructed[recBase] += coeffBuffer[coeffBase] * mhbValue;
				reconstructed[recBase + 1] += coeffBuffer[coeffBase + 1] * mhbValue;
				reconstructed[recBase + 2] += coeffBuffer[coeffBase + 2] * mhbValue;
			}
		}

		const diffTexSize = this.calcPow2TexSize(numVertices);
		const diffBuffer = new Float32Array(diffTexSize * diffTexSize * 4);
		for (let i = 0; i < numVertices; i += 1) {
			const base = i * 3;
			const diffBase = i * 4;
			diffBuffer[diffBase] = basePositions[base] - reconstructed[base];
			diffBuffer[diffBase + 1] = basePositions[base + 1] - reconstructed[base + 1];
			diffBuffer[diffBase + 2] = basePositions[base + 2] - reconstructed[base + 2];
		}
		const diffTexture = this.createFloatDataTexture(diffBuffer, diffTexSize, diffTexSize, THREE.RGBAFormat);

		const filterBuffer = new Float32Array(coeffTexSize * coeffTexSize * 4);
		for (let i = 0; i < filterBuffer.length; i += 4) {
			filterBuffer[i] = 1.0;
			filterBuffer[i + 1] = 1.0;
			filterBuffer[i + 2] = 1.0;
			filterBuffer[i + 3] = 1.0;
		}
		const filterTexture = this.createFloatDataTexture(filterBuffer, coeffTexSize, coeffTexSize, THREE.RGBAFormat);

		return {
			numVertices,
			mhbTexSize,
			coeffTexSize,
			diffTexSize,
			mhbTexture,
			coeffTexture,
			filterTexture,
			diffTexture,
			filterBuffer
		};
	}

	async setLegacyManifoldModel(name) {
		const loadToken = ++this.modelLoadToken;
		const [geometry, mhbValues] = await Promise.all([this.loadObjGeometry(name), this.loadMhbVectors(name)]);
		if (loadToken !== this.modelLoadToken) {
			return;
		}

		const basePositions = new Float32Array(geometry.attributes.position.array);
		const vertexCount = basePositions.length / 3;
		const encodedPositions = new Float32Array(basePositions.length);
		for (let i = 0; i < vertexCount; i += 1) {
			const base = i * 3;
			encodedPositions[base] = i;
			encodedPositions[base + 1] = basePositions[base + 1];
			encodedPositions[base + 2] = basePositions[base + 2];
		}
		geometry.setAttribute("position", new THREE.BufferAttribute(encodedPositions, 3));

		const textures = this.buildLegacyTextures(basePositions, mhbValues);
		const center = new THREE.Vector3();
		const indexAttr = geometry.getIndex();
		const used = new Uint8Array(vertexCount);
		if (indexAttr) {
			const indexArray = indexAttr.array;
			for (let i = 0; i < indexArray.length; i += 1) {
				used[indexArray[i]] = 1;
			}
		} else {
			for (let i = 0; i < vertexCount; i += 1) {
				used[i] = 1;
			}
		}

		let minX = Infinity;
		let minY = Infinity;
		let minZ = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		let maxZ = -Infinity;
		for (let i = 0; i < vertexCount; i += 1) {
			if (!used[i]) {
				continue;
			}
			const base = i * 3;
			const x = basePositions[base];
			const y = basePositions[base + 1];
			const z = basePositions[base + 2];
			if (x < minX) minX = x;
			if (y < minY) minY = y;
			if (z < minZ) minZ = z;
			if (x > maxX) maxX = x;
			if (y > maxY) maxY = y;
			if (z > maxZ) maxZ = z;
		}
		center.set((minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5);

		let radius = 0;
		for (let i = 0; i < vertexCount; i += 1) {
			if (!used[i]) {
				continue;
			}
			const base = i * 3;
			const dx = basePositions[base] - center.x;
			const dy = basePositions[base + 1] - center.y;
			const dz = basePositions[base + 2] - center.z;
			const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
			if (dist > radius) {
				radius = dist;
			}
		}

		const material = new THREE.ShaderMaterial({
			uniforms: {
				uMHB: { value: textures.mhbTexture },
				uCoeff: { value: textures.coeffTexture },
				uFilter: { value: textures.filterTexture },
				uDiff: { value: textures.diffTexture },
				uNumVertices: { value: textures.numVertices },
				uMHBTexSize: { value: textures.mhbTexSize },
				uCoeffTexSize: { value: textures.coeffTexSize },
				uDiffTexSize: { value: textures.diffTexSize },
				uModelCenter: { value: center.clone() },
				uAmbientColor: { value: new THREE.Vector3(0.1, 0.1, 0.1) },
				uLightingDirection: { value: new THREE.Vector3(1.0, 0.0, 0.0) },
				uDirectionalColor: { value: new THREE.Vector3(0.22, 0.45, 0.4) },
				uMatColor: { value: new THREE.Vector3(0.2, 0.62, 1.0) },
				uMatSpecularColor: { value: new THREE.Vector3(0.3, 0.6, 0.5) }
			},
			vertexShader: LEGACY_MANIFOLD_VERTEX_SHADER,
			fragmentShader: LEGACY_MANIFOLD_FRAGMENT_SHADER
		});

		this.cleanupCurrentMesh();
		this.mesh = new THREE.Mesh(geometry, material);
		this.mesh.position.set(0, 0, 0);
		this.scene.add(this.mesh);
		this.basePositions = null;
		this.baseNormals = null;
		this.legacyState = {
			filterBuffer: textures.filterBuffer,
			filterTexture: textures.filterTexture,
			coeffTexSize: textures.coeffTexSize,
			lightingTheta: 0
		};

		this.camera.position.set(0, 0, Math.max(3.2, radius * 3.0));
		this.controls.target.set(0, 0, 0);
		this.controls.update();
		this.updateSceneTheme(document.documentElement.getAttribute("data-theme") || "light");
	}

	async setModel(name) {
		this.currentModelName = name;
		this.setError("");
		if (this.deformationMode === "procedural") {
			this.setProceduralModel(name);
			return;
		}

		try {
			await this.setLegacyManifoldModel(name);
		} catch (err) {
			console.error(err);
			this.setError("Legacy manifold mode failed to load. Falling back to procedural mode.");
			this.deformationMode = "procedural";
			if (this.modeSelect) {
				this.modeSelect.value = "procedural";
			}
			this.setProceduralModel(name);
		}
	}

	updateLegacyFilterTexture() {
		if (!this.legacyState || !this.mesh || !this.mesh.material || !this.mesh.material.uniforms) {
			return;
		}

		const filterBuffer = this.legacyState.filterBuffer;
		const gainScale = this.gainHighFreq / 10;
		for (let k = 0; k < NUM_HARMONICS; k += 1) {
			let coeff = 1.0;
			if (this.isPlaying && this.frequencyData && this.frequencyData.length > 0) {
				const sampleIndex = Math.floor((k / Math.max(1, NUM_HARMONICS - 1)) * (this.frequencyData.length - 1));
				const normalized = this.frequencyData[sampleIndex] / 255;
				coeff = 0.2 + Math.pow(normalized, 1.15) * (1.3 + gainScale * 1.4);
			}
			const texBase = k * 4;
			filterBuffer[texBase] = coeff;
			filterBuffer[texBase + 1] = coeff;
			filterBuffer[texBase + 2] = coeff;
			filterBuffer[texBase + 3] = 1.0;
		}

		this.legacyState.filterTexture.needsUpdate = true;
		this.legacyState.lightingTheta += 0.05;
		const theta = this.legacyState.lightingTheta;
		const phi = 1.0;
		this.mesh.material.uniforms.uLightingDirection.value.set(
			Math.sin(phi) * Math.cos(theta),
			Math.cos(phi) * Math.sin(theta),
			Math.cos(phi)
		);
	}

	initAudio() {
		const Ctor = window.AudioContext || window.webkitAudioContext;
		if (!Ctor) {
			this.setError("Web Audio API is not supported in this browser.");
			this.setButtons(false, false);
			return;
		}

		this.audioContext = new Ctor();
		this.analyser = this.audioContext.createAnalyser();
		this.analyser.fftSize = 2048;
		this.analyser.smoothingTimeConstant = 0.75;
		this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
		this.setButtons(false, false);

		this.loadFromUrl(sampleAudioUrl)
			.then(() => {
				this.setButtons(true, false);
				this.setError("");
			})
			.catch((err) => {
				console.error(err);
				this.setError("Sample audio could not be loaded. Drop an MP3 file into the page.");
				this.setButtons(false, false);
			});
	}

	async loadFromUrl(url) {
		if (!this.audioContext) {
			return;
		}

		const response = await fetch(url);
		if (!response.ok) {
			throw new Error("Audio fetch failed with status " + response.status + ".");
		}
		const data = await response.arrayBuffer();
		this.audioBuffer = await this.decodeAudioData(data);
	}

	decodeAudioData(data) {
		return new Promise((resolve, reject) => {
			const maybePromise = this.audioContext.decodeAudioData(data, resolve, reject);
			if (maybePromise && typeof maybePromise.then === "function") {
				maybePromise.then(resolve).catch(reject);
			}
		});
	}

	async loadFromArrayBuffer(data) {
		if (!this.audioContext) {
			return;
		}
		this.audioBuffer = await this.decodeAudioData(data);
		this.setButtons(true, this.isPlaying);
		this.setError("Audio loaded successfully.");
	}

	stopSourceIfNeeded() {
		if (this.sourceNode) {
			try {
				this.sourceNode.stop(0);
			} catch (e) {
				// no-op if already stopped
			}
			this.sourceNode.disconnect();
			this.sourceNode = null;
		}
	}

	async play() {
		if (!this.audioContext || !this.audioBuffer) {
			return;
		}

		if (this.audioContext.state === "suspended") {
			await this.audioContext.resume();
		}

		this.stopSourceIfNeeded();
		this.sourceNode = this.audioContext.createBufferSource();
		this.sourceNode.buffer = this.audioBuffer;
		this.sourceNode.loop = true;
		this.sourceNode.connect(this.analyser);
		this.sourceNode.connect(this.audioContext.destination);
		this.sourceNode.start(0);
		this.isPlaying = true;
		this.setButtons(false, true);
		this.setError("");
	}

	stop() {
		this.stopSourceIfNeeded();
		this.isPlaying = false;
		this.setButtons(!!this.audioBuffer, false);
	}

	bindUi() {
		this.playButton.addEventListener("click", () => {
			this.play().catch((err) => {
				console.error(err);
				this.setError("Could not start playback. Try interacting with the page and press Play again.");
			});
		});

		this.stopButton.addEventListener("click", () => this.stop());

		this.modelSelect.addEventListener("change", () => {
			this.setModel(this.modelSelect.value).catch((err) => {
				console.error(err);
				this.setError("Could not change model.");
			});
		});

		if (this.modeSelect) {
			this.modeSelect.addEventListener("change", () => {
				this.setDeformationMode(this.modeSelect.value);
				this.setModel(this.currentModelName).catch((err) => {
					console.error(err);
					this.setError("Could not switch render mode.");
				});
			});
		}

		this.gainSlider.addEventListener("input", () => {
			this.gainHighFreq = Number(this.gainSlider.value || 3);
		});

		if (this.themeToggleButton) {
			this.themeToggleButton.addEventListener("click", () => {
				const currentTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
				const nextTheme = currentTheme === "dark" ? "light" : "dark";
				this.applyTheme(nextTheme);
				localStorage.setItem("musicvis-theme", nextTheme);
			});
		}

		document.addEventListener("dragover", (evt) => {
			evt.preventDefault();
		});

		document.addEventListener("drop", (evt) => {
			evt.preventDefault();
			const files = evt.dataTransfer && evt.dataTransfer.files;
			if (!files || files.length === 0) {
				return;
			}
			const file = files[0];
			if (!file.type || !file.type.startsWith("audio/")) {
				this.setError("Dropped file is not an audio file.");
				return;
			}

			const reader = new FileReader();
			reader.onload = () => {
				this.loadFromArrayBuffer(reader.result)
					.then(() => this.play())
					.catch((err) => {
						console.error(err);
						this.setError("Could not decode dropped audio file.");
					});
			};
			reader.onerror = () => {
				this.setError("Could not read dropped audio file.");
			};
			reader.readAsArrayBuffer(file);
		});
	}

	updateMesh() {
		const time = performance.now() * 0.001;

		if (this.isPlaying && this.analyser) {
			this.analyser.getByteFrequencyData(this.frequencyData);
			const len = this.frequencyData.length;
			const lowEnd = Math.floor(len * 0.1);
			const midEnd = Math.floor(len * 0.4);
			const highEnd = Math.floor(len * 0.8);
			let low = 0, mid = 0, high = 0;
			for (let i = 0; i < lowEnd; i++) low += this.frequencyData[i];
			for (let i = lowEnd; i < midEnd; i++) mid += this.frequencyData[i];
			for (let i = midEnd; i < highEnd; i++) high += this.frequencyData[i];
			this.audioLow  = (low  / lowEnd)           / 255;
			this.audioMid  = (mid  / (midEnd - lowEnd)) / 255;
			this.audioHigh = (high / (highEnd - midEnd)) / 255;
		} else {
			this.audioLow  *= 0.9;
			this.audioMid  *= 0.9;
			this.audioHigh *= 0.9;
		}

		if (this.bgMesh) {
			this.bgMesh.material.uniforms.uTime.value     = time;
			this.bgMesh.material.uniforms.uAudioLow.value = this.audioLow;
			this.bgMesh.material.uniforms.uAudioMid.value = this.audioMid;
			this.bgMesh.material.uniforms.uAudioHigh.value = this.audioHigh;
		}
		if (this.particles) {
			this.particles.material.uniforms.uTime.value     = time;
			this.particles.material.uniforms.uAudioLow.value = this.audioLow;
			this.particles.material.uniforms.uAudioHigh.value = this.audioHigh;
		}

		if (!this.mesh) {
			return;
		}

		if (this.deformationMode === "manifold") {
			this.updateLegacyFilterTexture();
			return;
		}

		if (!this.basePositions || !this.baseNormals) {
			return;
		}

		const positionAttr = this.mesh.geometry.attributes.position;
		const positions = positionAttr.array;

		const gainScale = this.gainHighFreq / 10;
		for (let i = 0; i < positions.length; i += 3) {
			const baseX = this.basePositions[i];
			const baseY = this.basePositions[i + 1];
			const baseZ = this.basePositions[i + 2];

			const nX = this.baseNormals[i];
			const nY = this.baseNormals[i + 1];
			const nZ = this.baseNormals[i + 2];

			let amp =
				0.024 * Math.sin(time * 2.2 + baseX * 4.2 + baseY * 1.9) +
				0.017 * Math.cos(time * 1.4 + baseZ * 5.1 + baseY * 2.3);
			if (this.isPlaying && this.frequencyData) {
				const band = this.frequencyData[(i / 3 * 11) % this.frequencyData.length] / 255;
				amp += (band * band) * (0.28 + gainScale * 1.05);
			}

			positions[i] = baseX + nX * amp;
			positions[i + 1] = baseY + nY * amp;
			positions[i + 2] = baseZ + nZ * amp;
		}

		positionAttr.needsUpdate = true;
		this.mesh.rotation.y += 0.0025;
	}

	animate() {
		requestAnimationFrame(() => this.animate());
		this.updateMesh();
		this.controls.update();
		this.composer.render();
	}

	start() {
		this.initTheme();
		this.initRenderer();
		this.bindUi();
		this.setDeformationMode(this.modeSelect ? this.modeSelect.value : "manifold");
		this.setModel(this.modelSelect.value || "head").catch((err) => {
			console.error(err);
			this.setError("Initial model load failed.");
		});
		this.initAudio();
		this.animate();
	}
}

const app = new ModernMusicVisApp();
app.start();
