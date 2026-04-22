import { useState } from "react";
import React from "react";
import { StoryboardFrame, generateFrameImage, generateComfyUIFrame } from "../services/gemini";
import { motion, AnimatePresence } from "motion/react";
import { Play, Image as ImageIcon, Loader2 } from "lucide-react";

interface Props {
  frame: StoryboardFrame;
  onGenerateImage?: (frameNumber: number, imageUrl: string) => void;
  onPreview?: (frameNumber: number) => void;
  onUpdatePrompt?: (newPrompt: string) => void;
  imageUrl?: string;
  isHighQuality?: boolean;
  globalStyle?: string;
  projectContext?: string;
  aspectRatio?: string;
  engineConfigs?: {
    engine: "gemini" | "comfyui_t2i" | "comfyui_i2i" | "comfyui_i2i_prompt";
    comfyUrl: string;
    comfyNodeId: string;
    comfyWorkflow: string;
    referenceImages?: { id: string, url: string, name: string }[];
  };
  customApiKey?: string;
  key?: any;
}

export function StoryboardFrameCard({ 
  frame, 
  onGenerateImage, 
  onPreview, 
  onUpdatePrompt,
  imageUrl, 
  isHighQuality, 
  globalStyle, 
  projectContext,
  aspectRatio,
  engineConfigs,
  customApiKey
}: Props) {
  const [isGenerating, setIsGenerating] = useState(false);

  const buildFinalPrompt = () => {
    let finalPrompt = frame.visualDescription;
    
    // Prepend: [景别], [镜头动作], [画面构图]
    const prefix = [frame.shotType, frame.cameraMovement, frame.composition].filter(Boolean).join(", ");
    if (prefix) finalPrompt = `${prefix}, ${finalPrompt}`;

    // Append Global context
    if (projectContext) {
      finalPrompt = `${finalPrompt}\n\n[Context]: ${projectContext}`;
    }

    // Append Styles
    const styleSuffix = [globalStyle, aspectRatio].filter(Boolean).join(", ");
    if (styleSuffix) finalPrompt = `${finalPrompt}\n\n[Output Specs]: ${styleSuffix}`;

    return finalPrompt;
  };

  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onGenerateImage) return;
    setIsGenerating(true);
    
    let retries = 0;
    const maxRetries = 4;
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const finalPrompt = buildFinalPrompt();

    while (retries <= maxRetries) {
      try {
        let url;
        if (engineConfigs?.engine?.startsWith("comfyui")) {
          const isI2I = engineConfigs.engine === "comfyui_i2i" || engineConfigs.engine === "comfyui_i2i_prompt";
          const urls = await generateComfyUIFrame(
            engineConfigs.comfyUrl,
            engineConfigs.comfyWorkflow,
            engineConfigs.comfyNodeId,
            finalPrompt,
            "", // Style already in finalPrompt
            false, // isBatchMode
            undefined, // sampler config
            isI2I ? engineConfigs.referenceImages : undefined
          );
          url = urls[0];
        } else {
          url = await generateFrameImage(finalPrompt, isHighQuality, "", "", aspectRatio, customApiKey);
        }
        onGenerateImage(frame.frameNumber, url);
        break; 
      } catch (error) {
        console.error(`Manual generation failed (Attempt ${retries + 1})`, error);
        const errorMsg = JSON.stringify(error) + String(error);
        
        if (errorMsg.includes("403")) {
          alert("权限不足 (403): 请检查 API Key。如果使用了 Banana Pro HQ 模式，请确保在页面右上角已选择您自己的 API Key (Member Quota)。");
          break;
        }

        if (errorMsg.includes("429")) {
          if (retries < maxRetries) {
             retries++;
             const backoff = Math.pow(2, retries) * 5000 + Math.random() * 1000;
             await sleep(backoff);
             continue;
          } else {
            alert("额度受限 (429): 请稍等一分钟再试，或切换为您自己的 API Key (Member Quota) 以继续使用。");
            break;
          }
        }
        break;
      }
    }
    setIsGenerating(false);
  };

  return (
    <div className="group relative aspect-[3/4] bg-[#25282C] rounded border border-[var(--border)] flex flex-col overflow-hidden">
      <div 
        className="relative aspect-video bg-[#1A1C1F] overflow-hidden flex items-center justify-center cursor-pointer flex-shrink-0"
        onClick={() => imageUrl && onPreview?.(frame.frameNumber)}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={`Frame ${frame.frameNumber}`} className="w-full h-full object-cover transition-transform hover:scale-105" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex flex-col items-center gap-2 p-4 text-center">
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
            ) : (
              <div className="opacity-20 flex flex-col items-center">
                <ImageIcon className="w-6 h-6 text-white mb-2" />
              </div>
            )}
          </div>
        )}

        <div className="absolute top-1 left-1 bg-black/80 text-[var(--accent)] text-[9px] font-mono px-1.5 py-0.5 rounded-sm leading-none border border-[var(--border)]">
          {frame.frameNumber.toString().padStart(2, '0')}
        </div>

        {isGenerating && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
          </div>
        )}

        {/* Top Right Action Buttons */}
        {!isGenerating && (
          <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {imageUrl && (
              <>
                <a
                  href={imageUrl}
                  download={`frame_${frame.frameNumber.toString().padStart(2, '0')}.jpg`}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-black/80 hover:bg-[var(--accent)] hover:text-black text-white p-1.5 rounded-sm transition-colors border border-[var(--border)]"
                  title="下载图片"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </a>
                <button
                  onClick={(e) => { e.stopPropagation(); onPreview?.(frame.frameNumber); }}
                  className="bg-black/80 hover:bg-[var(--accent)] hover:text-black text-white p-1.5 rounded-sm transition-colors border border-[var(--border)]"
                  title="放大预览"
                >
                  <ImageIcon className="w-3 h-3" />
                </button>
              </>
            )}
            <button
              onClick={handleGenerate}
              className="bg-black/80 hover:bg-[var(--accent)] hover:text-black text-[var(--accent)] p-1.5 rounded-sm transition-colors border border-[var(--border)]"
              title="重新生成此画面"
            >
              <Play className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      <div className="h-[90px] p-2 bg-[var(--surface)] border-t border-[var(--border)] flex flex-col justify-between">
        <div className="flex-1 overflow-y-auto mb-2 custom-scrollbar">
          <div className="flex gap-1 mb-1 items-center">
             <span className="text-[8px] bg-[#111] text-[var(--accent)] px-1 rounded-sm border border-[var(--border)]">{frame.shotType || "智能景别"}</span>
             <span className="text-[8px] bg-[#111] text-[var(--accent)] px-1 rounded-sm border border-[var(--border)]">{frame.cameraMovement || "固定镜头"}</span>
          </div>
          <textarea
             value={frame.visualDescription}
             onChange={(e) => onUpdatePrompt?.(e.target.value)}
             className="w-full h-full bg-transparent border-none text-xs leading-relaxed text-[var(--text-main)] font-medium p-0 outline-none focus:text-[var(--accent)] resize-none"
             placeholder="分镜画面描述..."
          />
        </div>
        <div className="flex gap-1 items-center flex-shrink-0 pt-1.5 border-t border-white/5">
          <Badge text="旁白" />
          <p className="text-[10px] text-[var(--text-dim)] italic truncate" title={frame.audioVoiceover}>{frame.audioVoiceover}</p>
        </div>
      </div>
    </div>
  );
}

function Badge({ text }: { text: string }) {
  return <span className="text-[7px] font-bold bg-[var(--accent)] text-black px-1 rounded-sm leading-none flex-shrink-0">{text}</span>;
}
