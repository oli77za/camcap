import React, { createRef, useEffect, useRef } from 'react';
import './App.css';
import cv, { CHAIN_APPROX_SIMPLE, LINE_8, VideoCapture } from "@techstark/opencv-js";
import Tesseract from 'tesseract.js';


export class SortableContour {
  perimeterSize: number = 0;
  areaSize: number = 0;
  contour: any;

  constructor(fields: Partial<SortableContour>) {
    Object.assign(this, fields);
  }
}

function App() {
  const videoRef = useRef<HTMLVideoElement>();
  const canvasRef1 = useRef<HTMLCanvasElement>();
  const canvasRef2 = useRef<HTMLCanvasElement>();
  const canvasRef3 = useRef<HTMLCanvasElement>();
  const canvasRef4 = useRef<HTMLCanvasElement>(null);
  const debugRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const videoCapRef = useRef<VideoCapture>();
  
  const videRefCallback = (ref: HTMLVideoElement) => {
    if (!ref) return;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then((stream) => {
      console.log(ref.src);
      ref.srcObject = stream;
      videoRef.current = ref;
      videoCapRef.current = new cv.VideoCapture(videoRef.current);
    });
    return;
  };



  const drawImage = () => {
    const video = videoRef.current;
    const canvas1 = canvasRef1.current;
    const canvas2 = canvasRef2.current;
    const canvas3 = canvasRef3.current;
    const canvas4 = canvasRef4.current;

    if (!video || !canvas1 || !canvas2 || !canvas3 || !canvas4 || video.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) {
      setTimeout(() => requestAnimationFrame(drawImage), 200);
      return;
    }


    const src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
    videoCapRef.current?.read(src);
    const grayscaledMat = new cv.Mat(video.height, video.width, cv.CV_8UC1);
    cv.cvtColor(src, grayscaledMat, cv.COLOR_RGBA2GRAY);
    cv.imshow(canvas1, grayscaledMat);

    const bilateralMat = new cv.Mat(video.height, video.width, cv.CV_8UC1);
    cv.bilateralFilter(grayscaledMat, bilateralMat, 11, 17, 17);

    const blurMat = new cv.Mat(video.height, video.width, cv.CV_8UC1);
    cv.GaussianBlur(bilateralMat, blurMat, new cv.Size(3, 3), 5, 0)
    cv.imshow(canvas2, blurMat);

    const cannyMat= new cv.Mat(video.height, video.width, cv.CV_8UC1);
    cv.Canny(blurMat, cannyMat, 50, 100, 3, false);
    cv.imshow(canvas3, cannyMat);


    const contours = new cv.MatVector();
    cv.findContours(cannyMat, contours, new cv.Mat(), cv.RETR_LIST, CHAIN_APPROX_SIMPLE);
    const s = contours.size() as unknown as number;
    const sortableContours: SortableContour[] = [];
    for (let i = 0; i < s; ++i) {
      const contour = contours.get(i);
      const areaSize = cv.contourArea(contour, false);
      const perimeterSize = cv.arcLength(contour, false);
      sortableContours.push({ areaSize, perimeterSize, contour});
    }
    const vec = new cv.MatVector();
    const sortedContours = sortableContours
      .sort((item1, item2) => item1.areaSize > item2.areaSize ? -1 : (item1.areaSize < item2.areaSize) ? 1 : 0)
      .filter((item) => item.areaSize >= 10000)
      .slice(0, 1);
      
    sortedContours.forEach((item) => vec.push_back(item.contour));

    const ctx = canvas4.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = 'white';
    // ctx?.fillRect(0, 0, canvasRef4.current.width, canvasRef4.current.height);
    ctx.drawImage(video, 0, 0, canvasRef4.current.width, canvasRef4.current.height);

    for (const sortableCont of sortedContours) {
      const approx = new cv.Mat();
      cv.approxPolyDP(sortableCont.contour, approx, .02 * sortableCont.perimeterSize, true);
      // if (approx.rows === 4) {
      if (true) {
          // vec.push_back(approx);
        ctx.strokeStyle = 'green';
        ctx.lineWidth = 4;
        const [x1, y1, x2, y2, x3, y3, x4, y4] = (approx.data32S as unknown as number[]);
        console.table([x1, y1, x2, y2, x3, y3, x4, y4]);
        ctx?.beginPath();
        ctx?.moveTo(x1, y1);
        ctx?.lineTo(x2, y2);
        ctx?.lineTo(x3, y3);
        ctx?.lineTo(x4, y4);
        ctx?.stroke()

        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.font = "20px Georgia";
        ctx?.strokeText('P1', x1, y1);
        ctx?.strokeText('P2', x2, y2);
        ctx?.strokeText('P3', x3, y3);
        ctx?.strokeText('P4', x4, y4);


        const cropX0 = Math.min(x1, x2, x3, x4);
        const cropX1 = Math.max(x1, x2, x3, x4);
        const cropY0 = Math.min(y1, y3, y2, y4);
        const cropY1 = Math.max(y1, y3, y2, y4);
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.height = cropX1 - cropX0;
        croppedCanvas.width = cropY1 - cropY0;
        const croppContext = croppedCanvas.getContext('2d');
        if (canvas1 && imgRef.current) {
          croppContext?.drawImage(canvas1, cropX0, cropY0, cropX1, cropY1, 0, 0, croppedCanvas.height, croppedCanvas.width);
          imgRef.current.width = croppedCanvas.width;
          imgRef.current.height = croppedCanvas.height;            
          imgRef.current.src = croppedCanvas.toDataURL();

          // Tesseract.recognize(croppedCanvas.toDataURL()).then((result) => console.log(result));
        }
      }
    }
    setTimeout(() => requestAnimationFrame(drawImage), 200);
  }

  useEffect(() => {
    canvasRef1.current = document.createElement('canvas');
    canvasRef2.current = document.createElement('canvas');
    canvasRef3.current = document.createElement('canvas');
    if (debugRef.current) {
      debugRef.current.appendChild(canvasRef3.current);
    }
    drawImage();
  }, []);

  return (
    <div className="App">
      <div>
        <video autoPlay width={400} height={300} ref={videRefCallback} style={{display: 'none'}} />
      </div>
      <div ref={debugRef} >
      {/* <canvas width={400} height={300} ref={canvasRef1} />
      <canvas width={400} height={300} ref={canvasRef2} />
      <canvas width={400} height={300} ref={canvasRef3} /> */}
      <canvas width={400} height={300} ref={canvasRef4} />
      <div>
        <img ref={imgRef} />
      </div>
      </div>
    </div>
  );
}

export default App;
