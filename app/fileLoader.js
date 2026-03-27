
function readBinaryFloat32File(path, thisModel, finishedFunc)
{
	var request = new XMLHttpRequest();
    request.open("GET", path, true);
    request.responseType = "arraybuffer";
    
    request.onload = function(oEvent)
    {
    	var arrayBuffer = request.response;
    	if(arrayBuffer)
    	{
    		arrayObject = new Float32Array(arrayBuffer);
    		console.log("successfully loaded Float32Array of size: " + arrayObject.length);
    		finishedFunc(arrayObject, thisModel);
    	}	
    }
    
    request.send();
    
}

function loadModel(path, thisModel, finishedFunc)
{
	var loader = new THREE.BinaryLoader();
	loader.load(path, function(geometry) {
							var model = new THREE.Mesh(geometry, new THREE.MeshFaceMaterial());
							finishedFunc(model, thisModel);
		});
}
