/*
 * This Audio Player is based on the following sources:
 * http://airtightinteractive.com/demos/js/reactive/ - A great WebAudioAPI example
 * http://jeromeetienne.github.com/slides/webaudioapi/#1 - A great slideshow on the basic elements of the WebAudioAPI 
 *
 */

/**
 * Bind the method to the right scope ...
 * http://stackoverflow.com/questions/1663553/javascript-object-method-name-for-settimeout 
 * http://www.pagecolumn.com/javascript/settimeout.htm
 * 
 * @this{AudioPlayer}
 * @param method the method that has to be put into the right scope (like: this.loadSampleAudio)
 * @returns returns the method in the correct scope
 */
AudioPlayer.prototype.bind = function(method) {
	var _this = this;
	 
	return(
		function(){
			return (method.apply(_this, arguments));
		}
	);
}


/**
 * Creates an instance of the class AudioPlayer.
 * This class can be used to easily playback songs with the experimental Web Audio API from Chrome (see https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html for Details)
 * 
 * @constructor
 * @this{AudioPlayer} 
 */ 
function AudioPlayer() {
	// Get the Audio Context from the browser (WebAudioAPI must be supported therefore)
	this.audioContext = new webkitAudioContext();	
	this.audioAnalyzer;
	this.audioProcessor;
	this.audioSource;
	this.audioBuffer;
	
	this.freqCnt = 512;	
	this.freqByteData;
	
	this.isPlaying = false;
	this.isInitialized = false;
	this.isStopped = false;
	
	// Vars needed for the visualization of the frequency histogram
	this.canvas;
	this.canvasCtx;
	this.stopRendering = false;
}

/**
 * Loads a sample audio file from the folder audio
 * 
 * @this{AudioPlayer} 
 */
AudioPlayer.prototype.loadSampleAudio = function() {
	console.log("Loading sample audio file ...");

	// Load the sample file
	this.loadFromURL("audio/test.mp3");
}

/**
 * Loads a *.mp3 file from the given URL and invokes it's playback.
 * 
 * @this{AudioPlayer} 
 * @param {string} url The URL to the *.mp3 file
 */
AudioPlayer.prototype.loadFromURL = function(url) {
	console.log("Loading Auio File from: " + url);

	// Disable the buttons
	$("#btnPlay").attr("disabled", true);
	$("#btnStop").attr("disabled", true);
	//$("#btnLoad").attr("disabled", true);
	
	// Save my instance for the callback
	var myself = this;
	
	// init request
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    // needed to process the audiostream!!!
    request.responseType = 'arraybuffer';

    // function called once data is loaded
    request.onload = function(){
        // Initialize the audiobuffer
       myself.initAudioBuffer(request.response);
    }

    request.send();	// Start the request
}

/**
 * Initializes the AudioSource and therefore the AudioSource.buffer with the given data.
 * 
 * @this{AudioPlayer} 
 * @param {arraybuffer} data can be an arraybuffer from an XMLHttpRequest or an already decoded buffer array 
 */
AudioPlayer.prototype.initAudioBuffer = function(data) {
	// Save my instance
	var myself = this;

	if(this.audioContext.decodeAudioData) {
		this.audioContext.decodeAudioData(data, function(buffer) {
			myself.audioBuffer = buffer;
			myself.addBufferToSource(myself.audioBuffer);
			//myself.audioSource.buffer = buffer;
			myself.createAudio();
		}, function(e) {
			console.log(e);
			//$('#loading').text("cannot decode mp3");
		});
	} else {
		this.audioBuffer = this.audioContext.createBuffer(data, false);
		//this.audioSource.buffer = this.audioContext.createBuffer(data, false );
		this.addBufferToSource(this.audioBuffer);
		this.createAudio();
	}
}


AudioPlayer.prototype.addBufferToSource = function(buffer) {
	// Disable the buttons, because I am disabling all playing songs (if there are any ;))
	$("#btnPlay").attr("disabled", true);
	$("#btnStop").attr("disabled", true);
	//$("#btnLoad").attr("disabled", true);
	
	//clean up previous mp3
	if (this.audioSource) this.audioSource.disconnect();
		
	// initialize a new buffered source
	this.audioSource = this.audioContext.createBufferSource();
	// loop the song
	this.audioSource.loop = true;
	this.audioSource.buffer = buffer;
	
	console.log("Finished loading MP3-file");
	
	$("#btnPlay").attr("disabled", false);
}

/**
 * Attach all needed audio nodes and start the playback
 * 
 * @this{AudioPlayer} 
 */
AudioPlayer.prototype.createAudio = function() {	
	// Create the routing of the modules
	this.audioProcessor = this.audioContext.createJavaScriptNode(2048 , 1 , 1 );
	//this.audioProcessor.onaudioprocess = processAudio;

	// Create an analyzer from the audio context
	this.audioAnalyzer = this.audioContext.createAnalyser();
	this.audioAnalyzer.fftSize = this.freqCnt;
	//this.audioAnalyzer.smoothingTimeConstant = 0.8;
	// Initialize the frequency data array needed for the frequency analysis
	this.freqByteData = new Uint8Array(this.audioAnalyzer.frequencyBinCount);

	this.audioSource.connect(this.audioContext.destination);
	this.audioSource.connect(this.audioAnalyzer);

	this.audioAnalyzer.connect(this.audioProcessor);
	this.audioProcessor.connect(this.audioContext.destination);
}

AudioPlayer.prototype.play = function() {
	if (this.isStopped === false) { // Play the song the first time => everything is already loaded
		// Start the Playback
		this.audioSource.noteOn(0);
		this.isPlaying = true;
		
		console.log("Playing the file");
		
		$("#btnPlay").attr("disabled", true);
		$("#btnStop").attr("disabled", false);
	} else { // Recreate the source and begin playing
		this.addBufferToSource(this.audioBuffer);
		this.createAudio();
		
		// Start the Playback
		this.audioSource.noteOn(0);
		this.isPlaying = true;
		
		console.log("Playing the file");
		
		$("#btnPlay").attr("disabled", true);
		$("#btnStop").attr("disabled", false);
		this.isStopped = false;
	}
}

/**
 * Stop the playback of the audio signal forever :D 
 * 
 * @this{AudioPlayer}
 */
AudioPlayer.prototype.stop = function() {
	if (this.isPlaying === true) {
		this.audioSource.noteOff(0);
		this.isPlaying = false;
		this.isStopped = true;
		
		console.log("Playing the file");
	
		$("#btnStop").attr("disabled", true);
		$("#btnPlay").attr("disabled", false);
		//$("#btnLoad").attr("disabled", false);
	} else {
		//$('#debug').text("player is not playing");
	}
}

/**
 * Get an histogram of the frequencies of the played audio signal.
 * The histogram is saved in a UINT8 Array.
 * 
 * @this{AudioPlayer} 
 * @returns {UINT8Array} freqByteData Returns a Byte Array with the actual frequency data of the audio which is playing 
 */
AudioPlayer.prototype.getByteFrequencyData = function() {
	if (this.isPlaying === true) {
		this.audioAnalyzer.getByteFrequencyData(this.freqByteData);
		return this.freqByteData;
	} else {
		var nullArray = new Uint8Array(1);
		return nullArray;
	}
}

AudioPlayer.prototype.getTransformedFreqData = function(k, min, max) {	
	if (this.isPlaying === true) {
		this.audioAnalyzer.getByteFrequencyData(this.freqByteData);
		return this.transformArray(this.freqByteData, k, min, max);
	} else {
		// If the sound is not playing return just 1s
		var transFreqData = new Float32Array(k);
		var i = 0;
		while (i<k)	transFreqData[i++]=1.0;
		
		return transFreqData;
	} 
}

AudioPlayer.prototype.getTransformedFreqDataWithGain = function(k, gain, min, max) {	
	if (this.isPlaying === true) {
		this.audioAnalyzer.getByteFrequencyData(this.freqByteData);
		return this.transformArrayWithGain(this.freqByteData, k, gain, min, max);
	} else {
		// If the sound is not playing return just 1s
		var transFreqData = new Float32Array(k);
		var i = 0;
		while (i<k)	transFreqData[i++]=1.0;
		
		return transFreqData;
	} 
}

AudioPlayer.prototype.getTransformedTimeDomainData = function(k, min, max) {	
	if (this.isPlaying === true) {
		this.audioAnalyzer.getByteTimeDomainData(this.freqByteData);
		return this.transformArray(this.freqByteData, k, min, max);
	} else {
		// If the sound is not playing return just 1s
		var transFreqData = new Float32Array(k);
		var i = 0;
		while (i<k)	transFreqData[i++]=1.0;
		
		return transFreqData;
	} 
}

AudioPlayer.prototype.transformArray = function(array, k, min, max) {
	// The transform ratio 
	var transRatio = k/array.length;
	transArray = new Float32Array(k);
	
	var idx, gain;
	var arrLen = array.length;
	for (var i=0; i < array.length; i++) {
		idx = Math.round(i*transRatio);
		gain = (3*i*i)/(arrLen*arrLen);
		transArray[idx] += array[i] + array[i] * gain;
	}
	
	return scaleArray(transArray, 0, 255/transRatio, min, max);
}

AudioPlayer.prototype.transformArrayWithGain = function(array, k, gainval, min, max) {
	// The transform ratio 
	var transRatio = k/array.length;
	transArray = new Float32Array(k);
	
	var idx, gain;
	var arrLen = array.length;
	for (var i=0; i < array.length; i++) {
		idx = Math.round(i*transRatio);
		gain = (gainval*i*i)/(arrLen*arrLen);
		transArray[idx] += array[i] + array[i] * gain;
	}
	
	return scaleArray(transArray, 0, 255/transRatio, min, max);
}

function scaleArray(hist, oldMin, oldMax, newMin, newMax) {
	/*
	// get min and max	
	// Get the maximum
	var oldMax = 0; 
	for(var i = 0; i<len; i++) if(hist[i] > oldMax) oldMax = hist[i];
	// Get the minimum
	var oldMin = hist[0];
	for(var i = 0; i<len; i++) if(hist[i] < oldMin) oldMin = hist[i];*/
	var len = hist.length;	
	var scaledHist = new Float32Array(len);
	//console.log("Max: " + oldMax + " Min: " + oldMin);
	
	for(var i=0; i<len; i++) {
		// Scale the values
		scaledHist[i] = (hist[i] - oldMin) * (newMax - newMin) / (oldMax-oldMin) + newMin;
	}
	
	return scaledHist;
}

/***************************************************
 * Frequency histogram on a canvas
 ***************************************************/

/**
 * Initialize the renderloop and canvas to display a Frequency histogram plot.
 * 
 * @this{AudioPlayer}
 * @param{canvas} canvas The canvas on which the Frequency histogram should be plotted.
 */ 
AudioPlayer.prototype.initFreqHist = function(canvas) {
	this.canvas = canvas;  
  	this.canvasCtx = canvas.getContext("2d");  
  	
  	// Start the reandering loop
  	this.renderLoop(); 
}

/**
 * The renderloop of the frequency histogram.
 * 
 * @this{AudioPlayer} 
 */
AudioPlayer.prototype.renderLoop = function() {			
	// render the frequency histogram
	this.renderFreqHist();
	
	// Do while stop rendering is set
	if (!this.stopRendering) {
		// Loop every 100 ms
		setTimeout(this.bind(this.renderLoop), 100);
	}
}

/**
 * The function to plot the frequency bins on the canvas.
 * This function should be called from the render loop!
 * 
 * @this{AudioPlayer} 
 */
AudioPlayer.prototype.renderFreqHist = function() {
	var canW = this.canvas.width;
	var canH = this.canvas.height;
	
	// Clear the canvas
	this.canvasCtx.clearRect(0, 0, canW, canH);
		
	// get the frequency data 
	//var freqData = this.getByteFrequencyData();
	var freqData = this.getTransformedFreqData(50,0,256);
	
	var freqCnt = freqData.length;
	
	binW = canW/freqCnt;
	
	this.canvasCtx.fillStyle = "black";
	
	for (var i=0; i < freqCnt; i++) {
		// Draw the histogram bins
		this.canvasCtx.fillRect(i*binW, canH - freqData[i]*canH/256, binW, canH);
	}
}

