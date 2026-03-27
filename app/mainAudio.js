/*
 * This Audio Player is based on the following sources:
 * http://airtightinteractive.com/demos/js/reactive/ - A great WebAudioAPI example
 * http://jeromeetienne.github.com/slides/webaudioapi/#1 - A great slideshow on the basic elements of the WebAudioAPI 
 *
 */

// The global audio player
var myAudioPlayer;

// the canvas needed if the histograms are shown
var canvas;
var canvasCtx;

function initAudio() {
	// Create an audioPlayer instance
	myAudioPlayer = new AudioPlayer();
	
	// Load the sample audio file
	myAudioPlayer.loadSampleAudio();
	
	// Initialize the Frequency Histogram
	//myAudioPlayer.initFreqHist(document.getElementById("canvas"));
	
	//init the listeners needed to detect drag&drop actions
	document.addEventListener('drop', onDocumentDrop, false);
	document.addEventListener('dragover', onDocumentDragOver, false);
}

function init2DCanvas() {
	canvas = document.getElementById("canvas");  
  	canvasCtx = canvas.getContext("2d");  
  	
  	mainLoop();
  /*
	canvasCtx.fillStyle = "black";  
	  
	canvasCtx.beginPath();  
	canvasCtx.moveTo(30, 30);  
	canvasCtx.lineTo(150, 150);  
	  // was: ctx.quadraticCurveTo(60, 70, 70, 150); which is wrong.  
	canvasCtx.bezierCurveTo(60, 70, 60, 70, 70, 150); // <- this is right formula for the image on the right ->  
	canvasCtx.lineTo(30, 30);  
	canvasCtx.fill();*/  
}

function onDocumentDragOver(evt) {
	//alert('drag over');
	evt.stopPropagation();
	evt.preventDefault();
	return false;
}

function onDocumentDrop(evt) {
	evt.stopPropagation();
	evt.preventDefault();
	
	//$('#loading').text("loading...");

	var droppedFiles = evt.dataTransfer.files;

	var reader = new FileReader();

	reader.onload = function(fileEvent) {
		var data = fileEvent.target.result;
		myAudioPlayer.initAudioBuffer(data);
	};

	reader.readAsArrayBuffer(droppedFiles[0]);

}

/*
function mainLoop() {
	// render the frequency histogram
	renderFreqHist();
	
	// Loop every 100 ms
	setTimeout(mainLoop, 100);
}

function renderFreqHist() {
	// Clear the canvas
	canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
		
	// get the frequency data 
	var freqData = myAudioPlayer.getByteFrequencyData();
	var freqCnt = freqData.length;
	
	binW = canvas.width/freqCnt;
	
	canvasCtx.fillStyle = "black";
	var canH = canvas.height;
	for (var i=0; i < freqCnt; i++) {
		canvasCtx.fillRect(i*binW, canH - freqData[i]*canH/256, binW, canH);
	}
}
*/