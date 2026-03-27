

MainPass = {

		vertexShader: [
		"uniform sampler2D uMHB;", 	//the basis vectors for the manifold harmonics transform
		"uniform sampler2D uCoeff;", 	//the transformed vertices
		"uniform sampler2D uFilter;",	//filter values
		"uniform sampler2D uDiff;",	//difference between original and reconstructed vertices
		
		"uniform int uNumVertices;",	//the number of vertices for this model
		"uniform int uNumHarmonics;",//the number of harmonics, in this case it is always 50
		"uniform int uMHBTexSize;",
		"uniform int uCoeffTexSize;",
		"uniform int uDiffTexSize;",

		"varying vec3 transNormal;",
		"varying vec3 eyeVec;",
		
		/**
		 * generates texture coordinates for the texel with index vIndex. used for accessing a texture
		 * which stores information per vertex. it is assumed that the texture is square with length texSize
		 */
		"vec2 texCoordVertexData(float texSize, float vIndex)",
		"{",
			"float x = floor(vIndex / texSize);",
			"float y = mod(vIndex, texSize);",
			"return vec2(y / (texSize - 1.0), x / (texSize - 1.0));", 
		"}",
		
		/**
		 * Computes the coordinates of the texel which contains the element of an array with the given index. (assuming RGBA pixel format)
		 * e.g. given the array [0,1,2,3,4,5,6,7], element with ind=5 is in the texel with index 1.
		*/
		"vec2 texCoordRGBAData(float texSize, float index)",
		"{",
			"float texelIndex = floor(index / 4.0);",
			"float x = floor(texelIndex / texSize);",
			"float y = mod(texelIndex, texSize);",
			"return vec2(y / (texSize - 1.0), x / (texSize - 1.0));",
		"}",
		
		
		"void main() {",
		
			"vec3 recPos = vec3(0.0, 0.0, 0.0);",
			
			"float vertexIndex = position.x;", //recover the vertex index stored in the x coordinate
			"for(int k = 0; k < 50; ++k)", //iterate over all harmonics
			"{",
				"float mhbIndex = float(k) * float(uNumVertices) + vertexIndex;",
				"vec2 mhbCoords = texCoordRGBAData(float(uMHBTexSize), mhbIndex);",
				"vec4 mhbTexel = texture2D(uMHB, mhbCoords).xyzw;",
				
				"vec2 freqCoords = texCoordVertexData(float(uCoeffTexSize), float(k));",
				"vec3 coeffs = texture2D(uCoeff, freqCoords).xyz;",
				"vec3 filter = texture2D(uFilter, freqCoords).xyz;",  

				/*determines the channel of the texel in which the desired value is contained*/
				"float mhbValue;",
				"int mhbCoord = int(mod(mhbIndex, 4.0));",
				
				"if(mhbCoord == 0) mhbValue = mhbTexel[0];", 
				"else if(mhbCoord == 1) mhbValue = mhbTexel[1];",
				"else if(mhbCoord == 2) mhbValue = mhbTexel[2];",
				"else if(mhbCoord == 3) mhbValue = mhbTexel[3];",
				
				/*inverse mht + filtering*/
				"recPos = recPos + (coeffs * filter * vec3(mhbValue, mhbValue, mhbValue));",
			"}",
			
			/*recover difference values*/
			"vec2 diffCoords = texCoordVertexData(float(uDiffTexSize), vertexIndex);",
			"vec3 diffVec = texture2D(uDiff, diffCoords).xyz;",

			"transNormal = normalMatrix * normal;",
			/* add the difference vector to the reconstructed vertex to get the perfect reconstruction (case: filter=1.0)*/
			"eyeVec = - vec3(modelViewMatrix * vec4((recPos + diffVec), 1.0));",

			"gl_Position = projectionMatrix * vec4(-eyeVec, 1.0);",
		
		"}"

		].join( "\n" ),
		
		fragmentShader: [
		
			"uniform vec3 uAmbientColor;",
			"uniform vec3 uLightingDirection;",
			"uniform vec3 uDirectionalColor;",
			"uniform vec3 uMatColor;",
			"uniform vec3 uMatSpecularColor;",

			"varying vec3 transNormal;",
			"varying vec3 eyeVec;",			
				
			/*just used for debugging*/
			"vec4 isEqual(float value, float reference)",
			"{",
				"if(value < (reference + 0.0001) && value > (reference - 0.0001))",
					"return vec4(0.0, 0.0, 1.0, 1.0);",
				"else",
					"return vec4(1.0, 0.0, 0.0, 1.0);",
			"}",
				
			"void main(void) {",
				/*phong shading*/
				"float directionalLightWeighting = max(dot(normalize(transNormal), normalize(uLightingDirection)), 0.0);",
				"vec3 lightMag = uAmbientColor + uDirectionalColor * directionalLightWeighting;",
				
				"vec3 color = uMatColor;",
				"float lambert = dot(normalize(transNormal),normalize(uLightingDirection));",
	
				"if(lambert > 0.0)",
				"{",
					"vec3 reflection = reflect(-normalize(uLightingDirection), normalize(transNormal));",
					"float specular = pow( max(dot(normalize(reflection), normalize(eyeVec)), 0.0), 15.0);",
					"color += uDirectionalColor * lambert + uMatSpecularColor * specular;",
				"}",
				
				"gl_FragColor = vec4(color, 1.0);",

			"}"
		].join( "\n" )
	
};
