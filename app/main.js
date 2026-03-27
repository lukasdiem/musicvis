
// Constant canvas size
var canW = 1000;
var canH = 600;

var numHarmonics = 50;
var loadedModelNr = 0;
var gainHighFreq = 3;

var modelName;
var modelMeshLocation;
var modelMHBLocation;

var renderer;
var gl;
var scene;
var camera;
var controls;
var start_time;

var currentModel = null;


function changeModel(dropdownSel) {	
	
	// remove old model if available
	if(currentModel !== null)
	{
		scene.remove(currentModel.mesh);
	}
	
	// Get the selected index from the dropdown menu
	
	var selectedModelIdx  = dropdownSel.selectedIndex;
	
	console.log("Changing the model to: " + modelName[selectedModelIdx]);
	
	loadedModelNr = selectedModelIdx;
	
	currentModel = new mhbModel(modelName[loadedModelNr], scene);
	currentModel.initMHBModel(modelMeshLocation[loadedModelNr], modelMHBLocation[loadedModelNr]);
	
	//camera.position.z = 1;
	//camera.position.x = 0;
	controls.target.set( 0, 0, 0 );
}

function main() 
{
	initModelList();
	init();
	initAudio();
	animate();
	
	var initModel = {selectedIndex: 0};
	changeModel(initModel);

}

function initModelList() {
	modelName = new Array(
		"head",
		"homer",
		"eight"
	);

	modelMeshLocation = new Array(modelName.length);
	modelMHBLocation = new Array(modelName.length);
	// Build paths from names
	for (var i=0; i < modelName.length; i++) {
		modelMeshLocation[i] = "models/" + modelName[i] + ".js";
		modelMHBLocation[i] = "models/" + modelName[i] + "_vectors.mhb";
	}
}

function init()
{
	// Check for the various File API support.
	if (window.File && window.FileReader && window.FileList && window.Blob) {
	} else {
	  alert("The File APIs are not fully supported in this browser.");
	}
	
	container = document.getElementById("container");
	renderer = new THREE.WebGLRenderer({ clearColor: 0xFFFFFF, clearAlpha: 1, antialias: true } );
	container.appendChild(renderer.domElement);
	gl = renderer.getContext();
	
	scene = new THREE.Scene();
	//var windowHalfX = window.innerWidth / 2;
	//var windowHalfY = window.innerHeight / 2;

	//camera = new THREE.PerspectiveCamera( 40, windowHalfX / windowHalfY, 1, 3000 );
	camera = new THREE.PerspectiveCamera( 40, canW / canH, 1, 3000 );
	camera.position.z = 1;
	camera.position.x = 0;
	scene.add(camera);
	
	controls = new THREE.TrackballControls(camera, renderer.domElement);
	controls.target.set( 0, 0, 0 );

	start_time = Date.now();
	
	// Set a fixed size of the WebGL content ...
	renderer.setSize(canW, canH);
	
	//onWindowResize();

	//window.addEventListener("resize", onWindowResize, false);
}

function onWindowResize( event ) 
{
	renderer.setSize( window.innerWidth, window.innerHeight );
}


function animate() {

    // note: three.js includes requestAnimationFrame shim
    //requestAnimationFrame(animate);
    render();

}

function render()
{
	controls.update();
	
	renderer.clear();

	updateModel(currentModel);
	
	renderer.render(scene, camera);	
	
	requestAnimationFrame(render);
}

function freeTexture(texture)
{
	if(texture !== null && texture !== undefined)
	{
		gl.deleteTexture(texture.__webglTexture);
		texture = null;
	}
	else
	{
		console.warn("attempt to delete null texture..");
		return;
	}
}

var lightTheta = 0.0;
var lightPhi = 1.0;

function updateModel(displayedModel) {
	
	if(displayedModel === null)
		return;

	var isPlay = myAudioPlayer.isPlaying;
	var isInit = displayedModel.isInitialized;

	if(isInit === true)
	{
		//update light:
		displayedModel.mesh.material.uniforms.uLightingDirection.value = new 
				THREE.Vector3(Math.sin(lightPhi)*Math.cos(lightTheta), Math.cos(lightPhi)*Math.sin(lightTheta), Math.cos(lightPhi));
		lightTheta += 0.05;
	}
	
	// Update the filter Coeffs only if the music is playing
	if (isPlay === true && isInit === true) {
		
		// update filter:
		var filterCoeffs = myAudioPlayer.getTransformedFreqDataWithGain(50, gainHighFreq, 0.2,1.7);
		// Uncomment this if you wanna use the Time Domain data instead of the frequency data
		//var filterCoeffs = myAudioPlayer.getTransformedTimeDomainData(50, 0.2,1.7);
		var coeffTexSize = calcPow2TexSize(numHarmonics);
		
		var buffer = new Array();
		for(var x = 0; x < coeffTexSize*coeffTexSize*3; ++x)
			buffer.push(0.0);
			
			
		for(var i = 0; i < filterCoeffs.length; ++i)
		{
			buffer[(3*i) + 0] = filterCoeffs[i];
			buffer[(3*i) + 1] = filterCoeffs[i];
			buffer[(3*i) + 2] = filterCoeffs[i];
		}
			
		var texture = displayedModel.filterTexture;
		
		gl.bindTexture(gl.TEXTURE_2D, texture.__webglTexture);
		//gl.texImage2D(gl.TEXTURE_2D, 0, dataArray, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, coeffTexSize, coeffTexSize, 0, gl.RGB, gl.FLOAT, new Float32Array(buffer));
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST );
		gl.bindTexture( gl.TEXTURE_2D, null )  


	} 
}
