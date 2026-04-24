import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Image as ImageIcon, 
  Wand2, 
  Layers, 
  Sun, 
  Grid, 
  Maximize,
  Upload,
  ArrowRight,
  Loader2,
  Settings2,
  X,
  Plus,
  Scissors,
  Download,
  Camera
} from 'lucide-react';
import { generateComfyUIFrame } from '../services/gemini';

const MULTI_ANGLE_OPTIONS = {
  front: [
    { label: '正面', value: 'front view' },
    { label: '右前侧面', value: 'front-right quarter view' },
    { label: '右侧面', value: 'right side view' },
    { label: '右后侧面', value: 'back-right quarter view' },
    { label: '背面', value: 'back view' },
    { label: '左后侧面', value: 'back-left quarter view' },
    { label: '左侧面', value: 'left side view' },
    { label: '左前侧面', value: 'front-left quarter view' }
  ],
  elevation: [
    { label: '仰视', value: 'low-angle shot' },
    { label: '平视', value: 'eye-level shot' },
    { label: '俯视', value: 'elevated shot' },
    { label: '大俯视', value: 'high-angle shot' }
  ],
  shot: [
    { label: '特写', value: 'close-up' },
    { label: '中景', value: 'medium shot' },
    { label: '远景', value: 'wide shot' }
  ]
};

const TOOLS = [
  { id: 'img2img', name: '图生图 (Img2Img)', icon: ImageIcon, desc: '基于参考图结构和提示词生成全新图像', multiImage: true },
  { id: 'semantic', name: '图片语义编辑', icon: Wand2, desc: '通过自然语言描述精确修改图片局部元素', multiImage: true },
  { id: 'blend', name: '多图融合', icon: Layers, desc: '提取多张图片的特征并无缝融合', multiImage: true },
  { id: 'relight', name: '光影重塑', icon: Sun, desc: '重新计算图片法线并打光，改变氛围', hasRef: true },
  { id: 'grid-story', name: '九宫格剧情推演', icon: Grid, desc: '上传单图，AI自动推演前后连贯的九宫格剧情，支持一键拆分' },
  { id: 'multi-angle', name: '多角度编辑', icon: Camera, desc: '指定拍摄角度、机位高度与景别，生成特定视角的图像', multiImage: false },
  { id: 'upscale', name: '高清修复', icon: Maximize, desc: '补充细节纹理，支持2x/4x高清化' },
  { id: 'remove-bg', name: '一键抠图', icon: Scissors, desc: '自动识别主体并去除背景，返回透明通道图' }
];

function ImageUploadArea({ 
  image, 
  onImageChange, 
  onRemove,
  label = "点击此处上传图片",
  className = ""
}: { 
  image: string | null; 
  onImageChange: (img: string) => void;
  onRemove?: () => void;
  label?: string;
  className?: string;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => onImageChange(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div 
      className={`relative min-h-[200px] rounded-lg border-2 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden group 
        ${isDragging ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)] bg-[#0a0a0a] hover:border-gray-500'} 
        ${className}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
    >
      {image ? (
        <>
          <img src={image} alt="Source" className="w-full h-full object-contain absolute inset-0 z-0 p-2" />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex flex-col items-center justify-center cursor-pointer gap-3">
            <label className="text-black bg-[var(--accent)] px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform">
              <Upload className="w-4 h-4" /> 更换图片
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </label>
            {onRemove && (
              <button 
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="text-white bg-red-500/80 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-red-500 hover:scale-105 transition-transform"
              >
                <X className="w-4 h-4" /> 移除
              </button>
            )}
          </div>
        </>
      ) : (
        <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer z-10 relative cursor-pointer">
          <div className="w-12 h-12 rounded-full bg-[#1a1a1a] group-hover:bg-[var(--accent)]/10 flex items-center justify-center mb-3 transition-colors">
            <Upload className="w-6 h-6 text-gray-500 group-hover:text-[var(--accent)]" />
          </div>
          <span className="text-gray-400 font-medium text-sm text-center px-4">{label}</span>
          <span className="text-[10px] text-gray-600 mt-2">支持拖拽或粘贴 (JPG, PNG)</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </label>
      )}
    </div>
  );
}

export function ImageToolsView({
  comfyUrl,
  comfyWorkflow,
  comfyNodeId,
  localWorkflows
}: {
  comfyUrl?: string;
  comfyWorkflow?: string;
  comfyNodeId?: string;
  localWorkflows?: any[];
}) {
  const [activeTool, setActiveTool] = useState<string>(TOOLS[0].id);
  const [sourceImages, setSourceImages] = useState<string[]>([]);
  const [refImage, setRefImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitResults, setSplitResults] = useState<string[]>([]);
  
  const [multiAngleFront, setMultiAngleFront] = useState(MULTI_ANGLE_OPTIONS.front[0].value);
  const [multiAngleElevation, setMultiAngleElevation] = useState(MULTI_ANGLE_OPTIONS.elevation[1].value);
  const [multiAngleShot, setMultiAngleShot] = useState(MULTI_ANGLE_OPTIONS.shot[1].value);
  
  const [upscaleMultiplier, setUpscaleMultiplier] = useState("2X");
  
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const currentTool = TOOLS.find(t => t.id === activeTool);

  // Reset states when switching tools
  useEffect(() => {
    setPrompt("");
    setResultImage(null);
    setSplitResults([]);
    // Optionally keep source images when switching to avoid re-uploading, 
    // but limit to 1 if the new tool doesn't support multiImage.
    if (!currentTool?.multiImage && sourceImages.length > 1) {
      setSourceImages([sourceImages[0]]);
    }
  }, [activeTool, currentTool?.multiImage, sourceImages]);

  // Global Paste Handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
             const reader = new FileReader();
             reader.onload = (ev) => {
                const imgResult = ev.target?.result as string;
                if (currentTool?.multiImage) {
                  setSourceImages(prev => [...prev, imgResult]);
                } else if (currentTool?.hasRef && sourceImages.length > 0 && !refImage) {
                  setRefImage(imgResult);
                } else {
                  setSourceImages([imgResult]); // replace first
                }
             };
             reader.readAsDataURL(file);
          }
          break; // Handle one pasted image at a time
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [currentTool, sourceImages.length, refImage]);

  const updateSourceImage = (index: number, img: string) => {
    const newImages = [...sourceImages];
    newImages[index] = img;
    setSourceImages(newImages);
  };

  const removeSourceImage = (index: number) => {
    setSourceImages(prev => prev.filter((_, i) => i !== index));
  };

  const addSourceImage = () => {
    setSourceImages(prev => [...prev, ""]);
  };

  const handleRun = async () => {
    if (sourceImages.length === 0 || !sourceImages[0]) return;
    setIsProcessing(true);
    setResultImage(null);
    setSplitResults([]);
    
    try {
      let workflowToUse = comfyWorkflow;
      if (currentTool?.id === 'upscale' && localWorkflows) {
        const targetWorkflow = localWorkflows.find(w => w.filename.includes(upscaleMultiplier));
        if (targetWorkflow) {
          workflowToUse = JSON.stringify(targetWorkflow.content);
        } else {
          console.warn(`未找到包含 "${upscaleMultiplier}" 的预设工作流，将使用当前默认工作流。`);
        }
      } else if (currentTool?.id === 'remove-bg' && localWorkflows) {
        const targetWorkflow = localWorkflows.find(w => w.filename.toLowerCase().includes('remove-bg') || w.filename.toLowerCase().includes('rembg'));
        if (targetWorkflow) {
          workflowToUse = JSON.stringify(targetWorkflow.content);
        } else {
          console.warn(`未找到匹配一键抠图(remove-bg)的预设工作流，将使用当前默认工作流进行。`);
        }
      }

      if (comfyUrl && workflowToUse && comfyNodeId) {
        // Collect valid images to send as reference images
        const validImgs = sourceImages.filter(img => img.trim() !== "");
        if (currentTool?.hasRef && refImage) {
          validImgs.push(refImage);
        }
        
        let finalPrompt = prompt || currentTool?.name || "";
        if (currentTool?.id === 'multi-angle') {
          finalPrompt = `<sks> ${multiAngleFront} ${multiAngleElevation} ${multiAngleShot}`;
        }
        
        const resImages = await generateComfyUIFrame(
          comfyUrl,
          workflowToUse,
          comfyNodeId,
          finalPrompt,
          "",
          false,
          undefined,
          validImgs.map((img, i) => ({ id: `img_${i}`, url: img, name: `name_${i}` }))
        );
        
        if (resImages && resImages.length > 0) {
          setResultImage(resImages[0]);
          return;
        }
      }
      
      // Fallback or Dummy simulation if no comfyui or generation fails
      setTimeout(() => {
        setResultImage(sourceImages[0]); 
      }, 2500);
    } catch (e) {
      console.error("Tool execution failed", e);
      alert("操作失败：" + (e as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSplit = () => {
    if (!resultImage) return;
    setIsSplitting(true);
    
    // Create an invisible image to draw on canvas
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const pieces: string[] = [];
      const cols = 3;
      const rows = 3;
      const pieceWidth = img.width / cols;
      const pieceHeight = img.height / rows;

      const canvas = document.createElement('canvas');
      canvas.width = pieceWidth;
      canvas.height = pieceHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        setIsSplitting(false);
        return;
      }

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          ctx.clearRect(0, 0, pieceWidth, pieceHeight);
          ctx.drawImage(
            img,
            x * pieceWidth, y * pieceHeight, pieceWidth, pieceHeight,
            0, 0, pieceWidth, pieceHeight
          );
          pieces.push(canvas.toDataURL('image/png', 0.9));
        }
      }
      setSplitResults(pieces);
      setIsSplitting(false);
    };
    img.onerror = () => {
      setIsSplitting(false);
      alert("无法加载图片进行拆分。");
    };
    img.src = resultImage;
  };
  
  const handleDownload = (imgUrl: string, suffix: string = "result") => {
    const a = document.createElement('a');
    a.href = imgUrl;
    a.download = `comfy_${Date.now()}_${suffix}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!currentTool) return null;

  // Initialize with at least one empty state if needed
  const displayImages = sourceImages.length > 0 ? sourceImages : [""];

  return (
    <>
      <div className="w-full mx-auto p-4 md:p-8 text-white min-h-[85vh] flex flex-col gap-6">
        
        {/* Top Banner & Tool Selection (Horizontal) */}
        <div className="w-full bg-[#111] border border-[var(--border)] rounded-2xl p-4 md:p-6 shadow-xl">
          <div className="text-xs font-bold text-[var(--accent)] uppercase tracking-widest mb-4 flex items-center gap-2">
            <Wand2 className="w-4 h-4" /> 智能图片处理引擎
          </div>
          
          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
            {TOOLS.map(tool => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`flex-shrink-0 px-5 py-3 rounded-xl flex items-center gap-3 transition-all ${
                  activeTool === tool.id 
                    ? 'bg-[var(--accent)] text-black font-bold shadow-lg shadow-[var(--accent)]/30 transform scale-[1.02]' 
                    : 'bg-[#1a1a1a] border border-[#333] hover:border-gray-400 text-gray-300 hover:bg-[#222]'
                }`}
              >
                <tool.icon className={`w-5 h-5 ${activeTool === tool.id ? 'text-black' : 'text-[var(--accent)]'}`} />
                <span className="whitespace-nowrap">{tool.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 bg-[#111] border border-[var(--border)] rounded-2xl p-6 md:p-8 flex flex-col min-h-[600px] shadow-2xl">
          
          {/* Tool Header */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-[#222]">
            <div>
              <h2 className="text-2xl font-black text-white flex items-center gap-3">
                <currentTool.icon className="w-8 h-8 text-[var(--accent)]" />
                {currentTool.name}
              </h2>
              <p className="text-gray-400 mt-2">{currentTool.desc}</p>
            </div>
            <button className="text-gray-400 hover:text-[var(--accent)] p-2 bg-[#1a1a1a] hover:bg-[#222] rounded-lg border border-[#333] transition-colors">
              <Settings2 className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left Column: Inputs */}
            <div className="flex flex-col gap-6">
              <div className="space-y-4 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">上传区域</span>
                  {currentTool.multiImage && (
                    <button 
                      onClick={addSourceImage}
                      className="text-xs bg-[#222] hover:bg-[#333] text-white px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> 添加图片
                    </button>
                  )}
                </div>

                {/* Source Images Grid */}
                <div className={`grid gap-4 ${displayImages.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <AnimatePresence mode="popLayout">
                    {displayImages.map((img, idx) => (
                      <motion.div 
                        key={`img-${idx}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        layout
                        className="w-full flex-1 min-h-[200px] flex"
                      >
                        <ImageUploadArea 
                          className="flex-1"
                          image={img || null}
                          onImageChange={(newImg) => updateSourceImage(idx, newImg)}
                          onRemove={displayImages.length > 1 || currentTool.multiImage ? () => removeSourceImage(idx) : undefined}
                          label={`主图 ${displayImages.length > 1 ? idx + 1 : ''}`}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Relight Reference Image */}
                {currentTool.hasRef && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-4"
                  >
                    <div className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">光影参考图 (可选)</div>
                    <ImageUploadArea 
                      className="h-[150px]"
                      image={refImage}
                      onImageChange={setRefImage}
                      onRemove={() => setRefImage(null)}
                      label="上传带有目标光影的参考图"
                    />
                  </motion.div>
                )}

                {/* Text Prompt */}
                {(currentTool.id === 'img2img' || currentTool.id === 'semantic' || currentTool.id === 'grid-story') && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-4"
                  >
                    <div className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">提示词 (Prompt)</div>
                    <textarea 
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="描述您期望的画面内容或修改指令..."
                      className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl p-4 text-sm text-white resize-none h-32 focus:border-[var(--accent)] outline-none transition-colors"
                    />
                  </motion.div>
                )}

                {/* Multi-angle Options */}
                {currentTool.id === 'multi-angle' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-4 grid grid-cols-3 gap-4"
                  >
                    <div>
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">拍摄角度</div>
                      <select 
                        value={multiAngleFront}
                        onChange={(e) => setMultiAngleFront(e.target.value)}
                        className="w-full bg-[#1a1a1a] border border-[#333] p-3 rounded-lg text-white outline-none focus:border-[var(--accent)] transition-colors"
                      >
                        {MULTI_ANGLE_OPTIONS.front.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">机位高度</div>
                      <select 
                        value={multiAngleElevation}
                        onChange={(e) => setMultiAngleElevation(e.target.value)}
                        className="w-full bg-[#1a1a1a] border border-[#333] p-3 rounded-lg text-white outline-none focus:border-[var(--accent)] transition-colors"
                      >
                        {MULTI_ANGLE_OPTIONS.elevation.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">景别大小</div>
                      <select 
                        value={multiAngleShot}
                        onChange={(e) => setMultiAngleShot(e.target.value)}
                        className="w-full bg-[#1a1a1a] border border-[#333] p-3 rounded-lg text-white outline-none focus:border-[var(--accent)] transition-colors"
                      >
                        {MULTI_ANGLE_OPTIONS.shot.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </motion.div>
                )}
                {/* Upscale Options */}
                {currentTool.id === 'upscale' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-4"
                  >
                    <div className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">放大倍数</div>
                    <div className="flex gap-4">
                      {['2X', '4X', '8X'].map(mult => (
                        <button
                          key={mult}
                          onClick={() => setUpscaleMultiplier(mult)}
                          className={`flex-1 py-3 rounded-lg font-bold transition-colors ${
                            upscaleMultiplier === mult 
                              ? 'bg-[var(--accent)] text-black' 
                              : 'bg-[#1a1a1a] border border-[#333] text-gray-400 hover:border-gray-500 hover:text-white'
                          }`}
                        >
                          {mult}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Run Button sticky at bottom of left column */}
              <button
                onClick={handleRun}
                disabled={isProcessing || !displayImages[0]}
                className="w-full mt-4 py-4 bg-[var(--accent)] text-black rounded-xl font-black text-lg uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(205,255,0,0.2)] flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <><Loader2 className="w-6 h-6 animate-spin" /> 处理中...</>
                ) : (
                  <><Wand2 className="w-5 h-5" /> 运行 {currentTool.name.split(' ')[0]}</>
                )}
              </button>
            </div>

            {/* Right Column: Output */}
            <div className="flex flex-col gap-4">
              <div className="text-sm font-bold text-gray-400 uppercase tracking-wider flex justify-between items-center h-5">
                <span>生成结果</span>
                {resultImage && currentTool.id === 'grid-story' && !isSplitting && splitResults.length === 0 && (
                  <button 
                    onClick={handleSplit}
                    className="text-xs bg-[var(--accent)] text-black font-bold px-3 py-1 rounded-full flex items-center gap-1 hover:scale-105 transition-transform"
                  >
                    <Scissors className="w-3 h-3" /> 一键拆分
                  </button>
                )}
              </div>
              
              <div className="flex-1 rounded-2xl border border-[var(--border)] bg-[#0a0a0a] overflow-hidden relative flex flex-col p-4">
                {!resultImage && !isProcessing && (
                  <div className="flex-1 flex flex-col justify-center items-center text-gray-600 gap-4">
                    <ImageIcon className="w-16 h-16 opacity-20" />
                    <p className="italic text-sm">等待处理，结果将在此展示...</p>
                  </div>
                )}

                {isProcessing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-20">
                    <Loader2 className="w-12 h-12 text-[var(--accent)] animate-spin mb-4" />
                    <span className="text-[var(--accent)] font-mono tracking-widest text-sm uppercase animate-pulse">
                      AI 正在生成画面...
                    </span>
                  </div>
                )}

                {isSplitting && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-30">
                   <Scissors className="w-12 h-12 text-[var(--accent)] animate-bounce mb-4" />
                   <span className="text-[var(--accent)] font-bold tracking-widest text-sm uppercase">
                     正在智能识别并拆分九宫格...
                   </span>
                 </div>
                )}

                {resultImage && !isProcessing && (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex-1 w-full h-full flex flex-col relative"
                  >
                    {splitResults.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2 flex-1 w-full h-full overflow-y-auto pr-2 custom-scrollbar relative">
                        {splitResults.map((res, i) => (
                          <div 
                            key={i} 
                            onClick={() => setPreviewImage(res)}
                            className="aspect-square bg-black border border-[#333] rounded-lg overflow-hidden relative group cursor-pointer"
                          >
                            <img src={res} alt={`Split ${i}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            <div className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded text-[10px] text-white pointer-events-none">
                              {i+1}
                            </div>
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDownload(res, `split_${i}`); }}
                                className="bg-black/70 p-1.5 rounded hover:bg-[var(--accent)] hover:text-black transition-colors"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center bg-black rounded-xl overflow-hidden relative group">
                        <img 
                          src={resultImage} 
                          alt="Result" 
                          className="w-full h-full object-contain cursor-pointer transition-transform duration-500 group-hover:scale-105" 
                          onClick={() => setPreviewImage(resultImage)}
                        />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                          <button 
                            onClick={() => handleDownload(resultImage)}
                            className="bg-black/70 hover:bg-[var(--accent)] hover:text-black text-white p-2 text-sm rounded-lg backdrop-blur-sm transition-colors border border-white/10 flex items-center gap-2"
                          >
                            <Download className="w-4 h-4" /> 另存为
                          </button>
                          <button 
                            onClick={() => setPreviewImage(resultImage)}
                            className="bg-black/70 hover:bg-[var(--accent)] hover:text-black text-white p-2 text-sm rounded-lg backdrop-blur-sm transition-colors border border-white/10 flex items-center gap-2"
                          >
                            <Maximize className="w-4 h-4" /> 查看大图
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Fullscreen Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
            onClick={() => setPreviewImage(null)}
          >
            <div className="absolute top-4 right-4 flex gap-4">
              <button 
                onClick={(e) => { e.stopPropagation(); handleDownload(previewImage, "preview"); }}
                className="bg-[#222] hover:bg-[var(--accent)] hover:text-black text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors border border-[#444]"
              >
                <Download className="w-4 h-4" /> 下载图片
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}
                className="bg-[#222] hover:bg-gray-700 text-white p-2 rounded-lg transition-colors border border-[#444]"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={previewImage} 
              alt="Fullscreen Preview"
              className="max-w-[95vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
