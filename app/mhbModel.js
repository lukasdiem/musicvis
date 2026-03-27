/**
 * Constructor of the mhbModel class, Initializes the object with a name and the scene, which will include the mesh lateron.
  */
function mhbModel(name, scene)
{
	this.name = name;
	this.modelPath = null;
	this.mhbPath = null;
	
	this.scene = scene;
	this.id = mhbModel.staticCounter;
	this.mesh = null; //actually a THREE.Mesh
	this.mhb = null;
	this.mhbTexture = null;
	this.mhtCoefficients = null;
	this.mhtCoeffTexture = null;
	this.diffTex = null;
	
	this.numVertices = null;
	this.coeffTexSize;
	this.mhbTexSize;
	this.diffTexSize;
	
	// stores the original vertex positions
	this.positionsArray = null;
	this.isInitialized = false;
	
	++mhbModel.staticCounter;	
}

/**
 * Loads a mesh-model from the given modelLocation, computes vertexnormals if necessary and saves the initial positions of the vertices in a Float array. The loading of the
 * mesh happens asynchronous. After loading the mesh, the mhb is computed, saved into a texture, the manifold harmonics transform is computed and saved and the initial filter
 * coefficients are stored into a texture as well.
 */
mhbModel.prototype.initMHBModel = function(modelLocation, mhbLocation)
{
	console.log("initializing the mhb model " + this.name);
	this.modelPath = modelLocation;
	this.mhbPath = mhbLocation;

	loadModel(modelLocation, this, function(model, thisModel){
									thisModel.mesh = model;
									thisModel.mesh.name = thisModel.name;		
									
									if(thisModel.mesh.geometry.vertexNormals === undefined)
									{
										console.log("computing vertex normals for model " + thisModel.name);
										thisModel.mesh.geometry.computeVertexNormals();
									}
									
									// Calculate the bounding sphere before the EVIL HACK destroys the coordinates
									thisModel.mesh.geometry.computeBoundingSphere();
									thisModel.boundingSphere = thisModel.mesh.geometry.boundingSphere;
									
									thisModel.loadPosition = thisModel.mesh.positon;
									
									// Set the camera position
									if(camera !== undefined) {
										camera.position.x = 0;
										camera.position.y = 0;
										camera.position.z = 5 * thisModel.boundingSphere.radius;
									}

									// evil hack to circumvent the need vor vertex attributes, which for some reason 
									// didn't work out well. stores the vertex id into the x coordinate of each vertex
									var buf = new Array();
									var ind = 0.0;
									for(var v = 0; v < thisModel.mesh.geometry.vertices.length; ++v)
									{
										buf.push(thisModel.mesh.geometry.vertices[v].x);
										buf.push(thisModel.mesh.geometry.vertices[v].y);
										buf.push(thisModel.mesh.geometry.vertices[v].z);
										thisModel.mesh.geometry.vertices[v].x = ind;
										ind = ind + 1.0;
									}
									thisModel.positionsArray = new Float32Array(buf);
									
									thisModel.mesh.needsUpdate = true;
									thisModel.mesh.geometry.needsUpdate = true;
									
									
									loadMHB(thisModel.mhbPath, thisModel);
									
	});
	
}
	
mhbModel.staticCounter = 0;

/**
 * Loads the MHB from a file. Calls the followinig functions in order to finish the initialization of the model:
 * 	-convertMHBtoTexture, computeMHTCoeffs, initializeFilterTexture, genDetailsTexture
 * After the loading and preprocessing is done the model (its mesh) is added to the scene.
 */
function loadMHB(filePath, thisModel)
{
	if(thisModel.mhbTexture != null)
	{
		console.log("deleting old mhb textures..");
		for(var tex in thisModel.mhbTexture)
		{
			freeTexture(tex);
		}
	} 
	console.log("Loading new mhb from file: " + filePath);
	readBinaryFloat32File(filePath, thisModel, function(arrayObject, thisModel) {
												convertMHBtoTexture(arrayObject, thisModel);
												computeMHTCoeffs(thisModel); 
												initializeFilterTexture(thisModel);
												genDetailsTexture(thisModel);
												setMaterial(thisModel);
												thisModel.scene.add(thisModel.mesh);
	});
}

/**
 * Stores the mhb values into a float texture. This must be a power of two texture, The rest of the texture is then filled with zeros.
 */
function convertMHBtoTexture(mhb, model)
{
	console.log("finished loading mhb data file for model: " + model.name + "...");
    
    var numVertices = mhb.length / numHarmonics;
    
    model.mhb = mhb;
    
    if(numVertices - Math.floor(numVertices) !== 0)
    {
    	console.warn("Missmatch of numVertices and MHB!!");
    	throw("wrong sized input data");
    }
    
    model.numVertices = numVertices;
    
    //pack the whole mhb into a single 2D texture
    var mhbTexLength = calcPow2TexSize(mhb.length / 4);
    
    console.log("the mhb texture gets a size of " + mhbTexLength);   
    model.mhbTexSize = mhbTexLength;
    
    var buffer = new Array();
    for(var i = 0; i < model.mhbTexSize * model.mhbTexSize * 4; ++i)
    {
    	if(i < mhb.length)
    		buffer.push(mhb[i]);
    	else
    		buffer.push(0.0);
    }
    model.mhbTexture = genFloat32Texture(buffer, mhbTexLength, mhbTexLength, gl.RGBA);
}

/**
 * calculates the manifold harmonics transform for the vertices of the given model. Since the mesh stores the "modified" vertices (with the vertex index encoded into the x coord)
 * the original values are used stored in the positionsArray of the mhbModel.
 */
function computeMHTCoeffs(mhbModel)
{
	var mhbArray = mhbModel.mhb;
	var numVertices = mhbModel.numVertices;
	
	var coeffTexSize = calcPow2TexSize(numHarmonics);
	
	var buffer = new Array();
	for(var x = 0; x < coeffTexSize*coeffTexSize * 3; ++x)
		buffer.push(0.0);
	
	console.log("start computing MHT")
	
	for(var i = 0; i < numVertices; ++i)
		for(var k = 0; k < numHarmonics; ++k)
		{
			buffer[(3 * k) + 0] += mhbModel.positionsArray[(i*3) + 0] * mhbArray[k * numVertices + i];
			buffer[(3 * k) + 1] += mhbModel.positionsArray[(i*3) + 1] * mhbArray[k * numVertices + i];
			buffer[(3 * k) + 2] += mhbModel.positionsArray[(i*3) + 2] * mhbArray[k * numVertices + i];
		}
	
	mhbModel.mhtCoefficients = new Float32Array(buffer);
	mhbModel.coeffTexSize = coeffTexSize;
	mhbModel.mhtCoeffTexture = genFloat32Texture(buffer, coeffTexSize, coeffTexSize, gl.RGB);		
}

/** 
 * Generate the difference between the reconstructed model and the original model. This information is saved into another texture and sent to the graphics card.
 */
function genDetailsTexture(mhbModel)
{
	console.log("Building difference vectors");
	var c = mhbModel.mhtCoefficients;
	
	// generate the reconstructed points:
	var recBuf = new Array();
	var diffBuf = new Array();
	for(var x = 0; x < mhbModel.numVertices * 3; ++x)
	{
		recBuf.push(0.0);
		diffBuf.push(0.0);
	}
	for(var i = 0; i < mhbModel.numVertices; ++i)
		for(var k = 0; k < numHarmonics; ++k)
		{
			recBuf[(3 * i) + 0] += c[(k*3) + 0] * mhbModel.mhb[k * mhbModel.numVertices + i];
			recBuf[(3 * i) + 1] += c[(k*3) + 1] * mhbModel.mhb[k * mhbModel.numVertices + i];
			recBuf[(3 * i) + 2] += c[(k*3) + 2] * mhbModel.mhb[k * mhbModel.numVertices + i];
		}
	
	//compute difference vectors:
		
	for(var v = 0; v < mhbModel.numVertices; ++v)
	{
		diffBuf[(3*v) + 0] = mhbModel.positionsArray[(3*v) + 0] - recBuf[(3*v) + 0];
		diffBuf[(3*v) + 1] = mhbModel.positionsArray[(3*v) + 1] - recBuf[(3*v) + 1];
		diffBuf[(3*v) + 2] = mhbModel.positionsArray[(3*v) + 2] - recBuf[(3*v) + 2];
	}
	
	var diffTexSize = calcPow2TexSize(mhbModel.numVertices);
	mhbModel.diffTexSize = diffTexSize;
	// add padding:
	for(var len = diffBuf.length; len < (diffTexSize*diffTexSize*3); ++len)
		diffBuf.push(0.0);
	console.log("created diffBuf with length: " + diffBuf.length + " for texture with size: " + diffTexSize);
	
	mhbModel.diffTex = genFloat32Texture(diffBuf, diffTexSize, diffTexSize, gl.RGB);
}
/**
 * Generate a texture that will be used to update the filter for the inverse MHT. It is initialized with all 1.0 such that the original model is correctly reconstructed.
 */
function initializeFilterTexture(model) {

	var texture = model.filterTexture;
	
	console.log("Creating the updatable filter texture");
	
	var filterTexSize = calcPow2TexSize(numHarmonics);
		
	var buffer = new Array();
	// Initalize the filter with 1.0
	for(var x = 0; x < filterTexSize*filterTexSize*3; ++x)
		buffer.push(1.0);
	
	// fill the texture
	model.filterTexture = genFloat32Texture(buffer, filterTexSize, filterTexSize, gl.RGB);
	//updateTexture(texture, buffer, filterTexSize, filterTexSize, gl.RGB);
	//head.uniforms.uFilter.value = head.filterTexture;
}

/**
 * Generate the material of the model and initialize the uniforms
 */
function setMaterial(model)
{
	console.log("changing material of mhbModel " + model.name);
	
	model.uniforms = {	
		uMHB: {type: "t", value: 0, texture: model.mhbTexture},
		uCoeff: {type: "t", value: 1, texture: model.mhtCoeffTexture},
		uFilter: {type: "t", value: 2, texture: model.filterTexture},
		uDiff: {type: "t", value: 3, texture: model.diffTex},
		uAmbientColor: {type: "v3", value: new THREE.Vector3(0.1, 0.1, 0.1)},
		uLightingDirection:  {type: "v3", value: new THREE.Vector3(1.0, 0.0, 0.0)},
		uDirectionalColor: {type: "v3", value: new THREE.Vector3(0.2, 0.4, 0.3)},
		uMatColor: {type: "v3", value: new THREE.Vector3(0.2, 0.6, 1.0)},
		uMatSpecularColor: {type: "v3", value: new THREE.Vector3(0.3, 0.6, 0.5)},
		
		uNumVertices: {type: "i", value: model.numVertices},
		uNumHarmonics: {type: "i", value: numHarmonics},
		uMHBTexSize: {type: "i", value: model.mhbTexSize},
		uCoeffTexSize: {type: "i", value: model.coeffTexSize},
		uDiffTexSize: {type: "i", value: model.diffTexSize}
	};
	
	model.mesh.material = new THREE.ShaderMaterial({
										uniforms: model.uniforms,
										vertexShader: MainPass.vertexShader,
										fragmentShader: MainPass.fragmentShader
	});
	
	model.isInitialized = true;
}

/**
 * Return the length of a square power of two texture that can store at least numberOfTexels texels
 */
function calcPow2TexSize(numberOfTexels)
{
	return Math.pow(2, Math.ceil( Math.log(Math.ceil(Math.sqrt(numberOfTexels))) / Math.log(2)   ));
}

/*
 * Generate a float texture containing the information storred in the dataArray. The texture has the size width*length. Use as texel format gl.RGB or gl.RGBA
 */
function genFloat32Texture(dataArray, width, length, texelFormat)
{
	if (!gl.getExtension("OES_texture_float")) {
		throw("Requires OES_texture_float extension");
	}
	
	var texture = new THREE.Texture();
	texture.needsUpdate = false;
	texture.__webglTexture = gl.createTexture();
		
	gl.bindTexture( gl.TEXTURE_2D, texture.__webglTexture );
		
	gl.texImage2D(gl.TEXTURE_2D, 0, texelFormat, width, length, 0, texelFormat, gl.FLOAT, new Float32Array(dataArray));
	texture.__webglInit = false;
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE );
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE );
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST );
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST );
	gl.bindTexture( gl.TEXTURE_2D, null )
	return texture;
}
