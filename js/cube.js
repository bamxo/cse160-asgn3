// Cube class with texture support
class Cube {
  constructor(x = 0, y = 0, z = 0, size = 1.0, color = [1.0, 0.5, 0.0]) {
    this.position = [x, y, z];
    this.size = size;
    this.color = color;
    this.textured = false;
    this.textureID = 0;
    this.isPlane = false; // Flag to indicate if this is a plane instead of a cube
    this.isTransparent = false; // Flag for transparency
    
    // If color has 4 components (including alpha) and alpha is < 1, mark as transparent
    if (color.length >= 4 && color[3] < 1.0) {
      this.isTransparent = true;
    }
    
    // Create vertices data - 8 corners of the cube
    this.vertices = this.generateVertices();
    this.indices = this.generateIndices();
    this.normals = this.generateNormals();
    this.texCoords = this.generateTexCoords();
    
    // Buffer objects - will be initialized later
    this.vertexBuffer = null;
    this.indexBuffer = null;
    this.normalBuffer = null;
    this.texCoordBuffer = null;
    this.buffersInitialized = false;
    
    // Cache matrix to avoid creating new ones
    this.localMatrix = new Matrix4();
  }
  
  // Convert this cube into a flat plane (just top face)
  createPlane() {
    this.isPlane = true;
    
    // Only use top face of the cube - 4 vertices
    const halfSize = this.size / 2;
    
    // Create a flat plane at y = 0
    this.vertices = new Float32Array([
      -halfSize, 0,  halfSize,  // 0
       halfSize, 0,  halfSize,  // 1
       halfSize, 0, -halfSize,  // 2
      -halfSize, 0, -halfSize   // 3
    ]);
    
    // Use just the top face indices
    this.indices = new Uint16Array([
      0, 1, 2, 0, 2, 3  // top face only
    ]);
    
    // All normals point up
    this.normals = new Float32Array([
      0, 1, 0,   
      0, 1, 0,   
      0, 1, 0,   
      0, 1, 0
    ]);
    
    // Texture coordinates for the plane
    this.texCoords = new Float32Array([
      0, 0,  
      1, 0,  
      1, 1,  
      0, 1
    ]);
    
    // Reset buffer initialized flag to recreate buffers
    this.buffersInitialized = false;
    
    return this;
  }
  
  generateVertices() {
    const halfSize = this.size / 2;
    return new Float32Array([
      -halfSize, -halfSize,  halfSize,  // 0
       halfSize, -halfSize,  halfSize,  // 1
       halfSize,  halfSize,  halfSize,  // 2
      -halfSize,  halfSize,  halfSize,  // 3
      -halfSize, -halfSize, -halfSize,  // 4
       halfSize, -halfSize, -halfSize,  // 5
       halfSize,  halfSize, -halfSize,  // 6
      -halfSize,  halfSize, -halfSize   // 7
    ]);
  }
  
  generateIndices() {
    return new Uint16Array([
      0, 1, 2, 0, 2, 3,  // front
      1, 5, 6, 1, 6, 2,  // right
      5, 4, 7, 5, 7, 6,  // back
      4, 0, 3, 4, 3, 7,  // left
      3, 2, 6, 3, 6, 7,  // top
      4, 5, 1, 4, 1, 0   // bottom
    ]);
  }
  
  generateNormals() {
    return new Float32Array([
      0, 0, 1,   0, 0, 1,   0, 0, 1,   0, 0, 1,    // front
      0, 0, -1,  0, 0, -1,  0, 0, -1,  0, 0, -1,   // back
      0, 1, 0,   0, 1, 0,   0, 1, 0,   0, 1, 0,    // top
      0, -1, 0,  0, -1, 0,  0, -1, 0,  0, -1, 0,   // bottom
      1, 0, 0,   1, 0, 0,   1, 0, 0,   1, 0, 0,    // right
      -1, 0, 0,  -1, 0, 0,  -1, 0, 0,  -1, 0, 0    // left
    ]);
  }
  
  generateTexCoords() {
    return new Float32Array([
      0, 0,  1, 0,  1, 1,  0, 1,  // front
      1, 0,  0, 0,  0, 1,  1, 1,  // back
      0, 1,  1, 1,  1, 0,  0, 0,  // top
      1, 1,  0, 1,  0, 0,  1, 0,  // bottom
      1, 0,  1, 1,  0, 1,  0, 0,  // right
      0, 0,  1, 0,  1, 1,  0, 1   // left
    ]);
  }
  
  // Set up texture parameters
  enableTexture(textureID) {
    this.textured = true;
    this.textureID = textureID;
    console.log(`Cube texture enabled: ID ${textureID}`);
  }
  
  disableTexture() {
    this.textured = false;
  }
  
  translate(x, y, z) {
    this.position[0] += x;
    this.position[1] += y;
    this.position[2] += z;
    return this;
  }
  
  setPosition(x, y, z) {
    this.position[0] = x;
    this.position[1] = y;
    this.position[2] = z;
    return this;
  }
  
  setSize(size) {
    this.size = size;
    // Regenerate vertices if not a plane
    if (!this.isPlane) {
      this.vertices = this.generateVertices();
    } else {
      // If it's a plane, recreate the plane with new size
      this.createPlane();
    }
    return this;
  }
  
  setColor(color) {
    this.color = color;
    return this;
  }
  
  // Initialize buffers - call this once
  initBuffers(gl) {
    if (this.buffersInitialized) return;
    
    // Create and bind buffer for vertex positions
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);
    
    // Create and bind buffer for indices
    this.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);
    
    // Create and bind buffer for normals
    this.normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.normals, gl.STATIC_DRAW);
    
    // Create and bind buffer for texture coordinates
    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.texCoords, gl.STATIC_DRAW);
    
    this.buffersInitialized = true;
  }
  
  // Fast render method - optimized to reduce operations
  render(gl, modelMatrix, viewMatrix, projectionMatrix, u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix, u_Color, u_TextureWeight, u_Sampler) {
    // Make sure buffers are initialized
    this.initBuffers(gl);
    
    // Create a new matrix that includes the cube's position
    this.localMatrix.set(modelMatrix);
    this.localMatrix.translate(this.position[0], this.position[1], this.position[2]);
    
    // Set the matrices
    gl.uniformMatrix4fv(u_ModelMatrix, false, this.localMatrix.elements);
    gl.uniformMatrix4fv(u_ViewMatrix, false, viewMatrix.elements);
    gl.uniformMatrix4fv(u_ProjectionMatrix, false, projectionMatrix.elements);
    
    // Set color uniform
    gl.uniform3fv(u_Color, this.color);
    
    // Set alpha value based on transparency
    const u_Alpha = gl.getUniformLocation(gl.program, 'u_Alpha');
    if (u_Alpha) {
      if (this.isTransparent) {
        gl.uniform1f(u_Alpha, 0.0); // Fully transparent
      } else {
        gl.uniform1f(u_Alpha, 1.0); // Fully opaque
      }
    }
    
    // If transparent, enable blending
    if (this.isTransparent) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false); // Don't write to depth buffer for transparent objects
    }
    
    // Set texture weight (0 = color only, 1 = texture only)
    gl.uniform1f(u_TextureWeight, this.textured ? 1.0 : 0.0);
    
    // Set the active texture if textured
    if (this.textured) {
      // Ensure the texture ID is valid
      if (this.textureID !== undefined) {
        // Set the texture unit index to the sampler
        gl.uniform1i(u_Sampler, this.textureID);
        
        // Debug output for texture usage
        if (this.isTreeBlock) {
          console.log(`Rendering tree block with texture ID ${this.textureID}, textured=${this.textured}`);
        }
      } else {
        console.warn("Cube has textured=true but missing textureID");
        gl.uniform1f(u_TextureWeight, 0.0); // Fall back to color
      }
    }
    
    // Set position attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.vertexAttribPointer(gl.getAttribLocation(gl.program, 'a_Position'), 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(gl.getAttribLocation(gl.program, 'a_Position'));
    
    // Set normal attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
    gl.vertexAttribPointer(gl.getAttribLocation(gl.program, 'a_Normal'), 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(gl.getAttribLocation(gl.program, 'a_Normal'));
    
    // Set texture coordinates if textured
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.vertexAttribPointer(gl.getAttribLocation(gl.program, 'a_TexCoord'), 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(gl.getAttribLocation(gl.program, 'a_TexCoord'));
    
    // Bind index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    
    // Draw the cube or plane
    const count = this.isPlane ? 6 : 36; // 6 vertices for plane, 36 for cube
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
    
    // If transparent, restore state
    if (this.isTransparent) {
      gl.disable(gl.BLEND);
      gl.depthMask(true);
    }
  }
} 