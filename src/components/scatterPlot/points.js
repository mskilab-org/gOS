class Points {
  constructor(regl, gapX, gapY) {
    this.regl = regl;
    this.gap = gapX;
    this.offsetY = gapY;
    this.pointSize = 10;

    this.dataX = null;
    this.dataY = null;
    this.color = null;
    this.instances = 0;

    // A single position array for instancing (one vertex).
    const positions = [[0.0, 0.0]];

    this.drawCommand = regl({
      frag: `
        precision highp float;
        varying vec4 vColor;
        varying vec2 vPos;
        uniform float windowWidth;
        void main() {
          // Round point into a circle
          vec2 cxy = 2.0 * gl_PointCoord - 1.0;
          float r = dot(cxy, cxy);

          // Discard fragments outside of the circle or out of bounds
          if (vPos.x < 0.0 || vPos.x > windowWidth || r > 1.0) {
            discard;
          }
          gl_FragColor = vColor;
        }
      `,

      vert: `
        precision highp float;
        attribute vec2 position;
        attribute float dataX, dataY, color;
        attribute float dataX_hi, dataX_lo; // Our precise point data

        varying vec4 vColor;
        varying vec2 vPos;

        uniform vec2 domainX, domainY; 
        uniform float stageWidth, stageHeight;
        uniform float windowWidth, windowHeight, pointSize;
        uniform float offsetX, offsetY;
        uniform bool use_emulated_precision;

        uniform float domain_width;
        uniform float domainX_hi;
        uniform float domainX_lo;

        vec2 normalizeCoords(vec2 xy) {
          float x = xy[0];
          float y = xy[1];
          return vec2(
            2.0 * ((x / stageWidth) - 0.5),
            -(2.0 * ((y / stageHeight) - 0.5))
          );
        }

        void main() {
          float ky = -windowHeight / (domainY.y - domainY.x);
          float kx;
          float posX;

          if (use_emulated_precision) {
            kx = windowWidth / domain_width;

            float relative_hi = dataX_hi - domainX_hi;
            float relative_lo = dataX_lo - domainX_lo;

            float relative_pos = relative_hi + relative_lo;
            
            posX = kx * relative_pos;

            float red   = floor(color / 65536.0);
            float green = floor((color - red * 65536.0) / 256.0);
            float blue  = color - red * 65536.0 - green * 256.0;
            vec4 realColor = vec4(red / 255.0, green / 255.0, blue / 255.0, 0.5);

            // --- COMPILER TRICK ---
            // Force the compiler to keep 'relative_pos' alive by
            // adding an invisible value derived from it to the color.
            // This prevents the 'posX' calculation from being broken.
            realColor.r += (relative_pos / domain_width) * 0.0000001;
            // -----------------------

            vColor = realColor;

          } else {
            kx = windowWidth / (domainX.y - domainX.x);
            float relativeDataX = dataX - domainX.x;
            posX = kx * relativeDataX;

            float red   = floor(color / 65536.0);
            float green = floor((color - red * 65536.0) / 256.0);
            float blue  = color - red * 65536.0 - green * 256.0;
            vColor = vec4(red / 255.0, green / 255.0, blue / 255.0, 0.5);
          }

          float posY = windowHeight + ky * (dataY - domainY.x);

          float vecX = position.x + posX;
          float vecY = position.y + posY;

          vPos = vec2(vecX, vecY);

          vec2 clip = normalizeCoords(vec2(vecX + offsetX, vecY - offsetY));
          clip.y = clamp(clip.y, -1.0, 1.0);

          gl_PointSize = pointSize;
          gl_Position = vec4(clip, 0.0, 1.0);
        }
      `,

      attributes: {
        position: positions,    // Single vertex, instanced
        dataX: { buffer: regl.prop('dataX'), divisor: 1 },
        dataY: { buffer: regl.prop('dataY'), divisor: 1 },
        dataX_hi: { buffer: regl.prop('dataX_hi'), divisor: 1 },
        dataX_lo: { buffer: regl.prop('dataX_lo'), divisor: 1 },  
        color: { buffer: regl.prop('color'), divisor: 1 },
      },

      // We'll draw one point, instanced 'instances' times
      primitive: 'points',
      count: positions.length,
      instances: regl.prop('instances'),

      uniforms: {
        stageWidth: regl.prop('width'),
        stageHeight: regl.prop('height'),
        windowWidth: regl.prop('windowWidth'),
        windowHeight: regl.prop('windowHeight'),
        pointSize: regl.prop('pointSize'),
        domainX: regl.prop('domainX'), // Still needed for 'else' path
        domainY: regl.prop('domainY'),
        offsetX: regl.prop('offsetX'),
        offsetY: regl.prop('offsetY'),
        use_emulated_precision: regl.prop('use_emulated_precision'),

        domain_width: regl.prop('domain_width'),
        domainX_hi: regl.prop('domainX_hi'),
        domainX_lo: regl.prop('domainX_lo'),
      },

      depth: { enable: false },
      blend: {
        enable: true,
        func: {
          srcRGB: 'src alpha',
          srcAlpha: 1,
          dstRGB: 'one minus src alpha',
          dstAlpha: 1,
        },
        equation: { rgb: 'add', alpha: 'add' },
        color: [0, 0, 0, 0],
      },
    });
  }

  /**
   * Upload data to the GPU exactly once (or whenever the dataset changes).
   */
  setData(
    dataPointsX = null,
    dataPointsY,
    dataPointsColor,
    dataPointsX_hi = null,
    dataPointsX_lo = null
  ) {
    this.has_emulated_precision = !!dataPointsX_hi && !!dataPointsX_lo;

    this.instances = this.has_emulated_precision ? dataPointsX_hi.length : dataPointsX.length;

    let hi_array = dataPointsX_hi;
    let lo_array = dataPointsX_lo;

    // For non-emulated precision, create dummy arrays to avoid buffer size mismatch
    if (!this.has_emulated_precision) {
      hi_array = new Float32Array(this.instances);
      lo_array = new Float32Array(this.instances);
    }

    this.dataX = this.regl.buffer(dataPointsX || new Float32Array(this.instances));
    
    this.dataPointsX_hi = this.regl.buffer(hi_array);
    this.dataPointsX_lo = this.regl.buffer(lo_array);
    
    this.dataY = this.regl.buffer(dataPointsY);
    this.color = this.regl.buffer(dataPointsColor);
  }

  /**
   * Update domain, window size, and offsets for each chart/window.
   * No buffer uploads here; just uniform updates.
   */
  updateDomains(width, height, domains, maxYValues) {
    const windowWidth = (width - (domains.length - 1) * this.gap) / domains.length;
    const windowHeight = height;

    // A function to split a float64 into a F32-safe hi/lo pair
    // This mimics the 'double' FPU rounding
    function splitDouble(v) {
      const hi = new Float32Array([v])[0];
      const lo = v - hi;
      return { hi, lo };
    }

    this.dataBufferList = domains.map((domainX, i) => {
      const domain_start_full = domainX[0];
      const domain_end_full = domainX[1];

      const precise_domain_width = domain_end_full - domain_start_full;

      const { hi: domain_start_hi, lo: domain_start_lo } = splitDouble(domain_start_full);

      return {
        // Buffers (they never change unless setData is called)
        dataX: this.dataX,
        dataX_hi: this.dataPointsX_hi,
        dataX_lo: this.dataPointsX_lo,
        dataY: this.dataY,
        color: this.color,

        // Instancing count
        instances: this.instances,

        // Uniforms (width, height, domain, etc.)
        width,
        height,
        windowWidth,
        windowHeight,
        pointSize: this.pointSize,
        
        domainX: domainX,
        domainY: [0, maxYValues[i]],

        domain_width: precise_domain_width,
        domainX_hi: domain_start_hi,
        domainX_lo: domain_start_lo,

        offsetX: i * (this.gap + windowWidth),
        offsetY: this.offsetY,

        use_emulated_precision: this.has_emulated_precision,
      };
    });
  }

  /**
   * Render the points using the current uniform set (domain info) 
   * and the GPU buffers (points data).
   */
  render() {
    try {
      this.regl.clear({
        color: [0, 0, 0, 0],
        depth: false,
        stencil: true,
      });

      this.regl.poll();

      this.drawCommand(this.dataBufferList);
    } catch (err) {
      console.error(`Scatterplot WebGL rendering failed: ${err}`);
    }
  }
}

export default Points;
