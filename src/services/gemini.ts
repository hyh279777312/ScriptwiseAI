import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Character {
  name: string;
  description: string;
  clothing: string;
  makeup: string;
}

export interface Scene {
  name: string;
  setting: string;
  lighting: string;
  atmosphere: string;
}

export interface Prop {
  name: string;
  description: string;
  usage: string;
}

export interface StoryboardFrame {
  frameNumber: number;
  visualDescription: string;
  audioVoiceover: string;
  composition: string;
}

export interface AnalysisResult {
  characters: Character[];
  scenes: Scene[];
  props: Prop[];
  storyboard: StoryboardFrame[];
}

// Analysis: Gemini 3.1 Pro Preview (Member Quota)
// Image Generation: Nano Banana series (2.5 Regular / 3.1 High Quality)

export async function analyzeScript(script: string, referenceImages?: string[]): Promise<AnalysisResult> {
  const model = "gemini-3.1-pro-preview"; // Using the best available Pro model for analysis
  
  const contentParts: any[] = [
    { text: `
      你是一位专业的导演和分镜师。
      请分析以下故事梗概/剧本，提取角色、场景、道具，并生成一个专业的分镜矩阵。
      
      特别指令：
      1. 所有的输出内容必须使用【中文】。
      2. 不要 1:1 地将一句 VO 映射到一个画面。
      3. 将故事细分为更细致的节奏：包括关键帧 (Keyframes) 和过渡帧 (Transition frames)。
      4. 电影感节奏：使用多样的构图（特写、全景、过肩、倾斜镜头、第一人称视角等）。
      5. 视觉一致性：根据你自己提取的元数据，极其详尽地描述角色和道具。
      6. 动态数量：根据画面视觉复杂度决定分镜数量，而不是根据句子数量。 
      
      剧本内容：${script}
    `.trim() }
  ];

  if (referenceImages && referenceImages.length > 0) {
    referenceImages.forEach((img, index) => {
      contentParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: img.split(",")[1],
        },
      });
    });
  }

  const callModel = async (modelName: string) => {
    return await ai.models.generateContent({
      model: modelName,
      contents: { parts: contentParts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            characters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  clothing: { type: Type.STRING },
                  makeup: { type: Type.STRING },
                },
                required: ["name", "description", "clothing", "makeup"],
              },
            },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  setting: { type: Type.STRING },
                  lighting: { type: Type.STRING },
                  atmosphere: { type: Type.STRING },
                },
                required: ["name", "setting", "lighting", "atmosphere"],
              },
            },
            props: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  usage: { type: Type.STRING },
                },
                required: ["name", "description", "usage"],
              },
            },
            storyboard: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  frameNumber: { type: Type.INTEGER },
                  visualDescription: { type: Type.STRING },
                  audioVoiceover: { type: Type.STRING },
                  composition: { type: Type.STRING },
                },
                required: ["frameNumber", "visualDescription", "audioVoiceover", "composition"],
              },
            },
          },
          required: ["characters", "scenes", "props", "storyboard"],
        },
      },
    });
  };

  let response;
  try {
    response = await callModel(model);
  } catch (error: any) {
    const errorStr = JSON.stringify(error) + String(error);
    if (errorStr.includes("429") || errorStr.includes("RESOURCE_EXHAUSTED")) {
      console.warn("Gemini 3.1 Pro quota exhausted. Falling back to Gemini 2.5 Flash...");
      response = await callModel("gemini-2.5-flash"); // Fallback to a model with higher free tier
    } else {
      throw error;
    }
  }

  if (!response.text) {
    throw new Error("No response from AI");
  }

  return JSON.parse(response.text) as AnalysisResult;
}

// Deduplicated analyzeComfyUIScript removed here

export async function analyzeComfyUIScript(
  baseUrl: string,
  workflowStr: string,
  promptNodeId: string,
  outputNodeId: string,
  script: string
): Promise<{ text: string, parsed: AnalysisResult | null }> {
  const workflow = JSON.parse(workflowStr);
  const prompt = `
你是一位专业的导演和分镜师。
请分析以下故事梗概/剧本，提取角色、场景、道具，并生成一个专业的分镜矩阵。

特别指令：
1. 所有的输出内容必须使用【中文】。
2. 不要 1:1 地将一句 VO 映射到一个画面，要细分节奏使用多样的电影构图。
3. 视觉一致性：根据你自己提取的元数据，极其详尽地描述角色和道具。
4. 【重要】你的输出必须且只能为纯粹的JSON（不要用Markdown格式），完全匹配以下结构：
{
  "characters": [{ "name": "...", "description": "...", "clothing": "...", "makeup": "..." }],
  "props": [{ "name": "...", "description": "...", "usage": "..." }],
  "scenes": [{ "name": "...", "setting": "...", "lighting": "...", "atmosphere": "..." }],
  "storyboard": [{ "frameNumber": 1, "visualDescription": "...", "audioVoiceover": "...", "composition": "..." }]
}

剧本内容：
${script}
`.trim();

  if (workflow[promptNodeId] && workflow[promptNodeId].inputs) {
    if (workflow[promptNodeId].inputs.text !== undefined) workflow[promptNodeId].inputs.text = prompt;
    else if (workflow[promptNodeId].inputs.prompt !== undefined) workflow[promptNodeId].inputs.prompt = prompt;
  } else {
    throw new Error(`找不到对应的分析提示词 Node ID: ${promptNodeId}`);
  }

  const res = await fetch(`${baseUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow })
  });
  
  if (!res.ok) throw new Error(`ComfyUI 错误: ${res.statusText}`);
  const { prompt_id } = await res.json();

  while (true) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const histRes = await fetch(`${baseUrl}/history/${prompt_id}`);
      if (!histRes.ok) continue;
      const histData = await histRes.json();
      
      if (histData[prompt_id]) {
        const outputs = histData[prompt_id].outputs;
        if (outputs[outputNodeId]) {
          const nodeOut = outputs[outputNodeId];
          let resultText = nodeOut.text?.[0] || nodeOut.string?.[0] || nodeOut.message?.[0];
          if (!resultText && Array.isArray(nodeOut)) resultText = nodeOut[0];
          
          if (resultText && typeof resultText === "string") {
            try {
              const match = resultText.match(/\{[\s\S]*\}/);
              const jsonStr = match ? match[0] : resultText;
              const parsed = JSON.parse(jsonStr) as AnalysisResult;
              return { text: resultText, parsed };
            } catch (parseError) {
              // Return raw text if JSON parsing fails
              return { text: resultText, parsed: null };
            }
          } else {
            throw new Error("无法从输出节点提取文本。");
          }
        }
      }
    } catch(e) {
      if (e instanceof Error && (e.message.includes("无法从输出节点提取文本") || e.message.includes("JSON"))) {
        throw e;
      }
    }
  }
}

export async function generateComfyUIFrame(
  baseUrl: string,
  workflowStr: string,
  promptNodeId: string,
  description: string,
  globalStyle?: string
): Promise<string> {
  const workflow = JSON.parse(workflowStr);
  const fullPrompt = `${description}, ${globalStyle || ""}`;

  if (workflow[promptNodeId] && workflow[promptNodeId].inputs) {
    if ('text' in workflow[promptNodeId].inputs) workflow[promptNodeId].inputs.text = fullPrompt;
    else if ('prompt' in workflow[promptNodeId].inputs) workflow[promptNodeId].inputs.prompt = fullPrompt;
    else workflow[promptNodeId].inputs.text = fullPrompt;
  } else {
    throw new Error(`找不到对应的 Prompt Node ID: ${promptNodeId}，请检查 JSON`);
  }

  // Check random seed in common sampler nodes (node 3 is KSampler in default workflow)
  for (const key in workflow) {
    if (workflow[key].class_type === "KSampler" && workflow[key].inputs) {
      workflow[key].inputs.seed = Math.floor(Math.random() * 1000000000000000);
    }
  }

  const res = await fetch(`${baseUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow })
  });
  
  if (!res.ok) {
     throw new Error(`ComfyUI 错误: ${res.statusText}`);
  }
  
  const { prompt_id } = await res.json();

  while (true) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const histRes = await fetch(`${baseUrl}/history/${prompt_id}`);
      if (!histRes.ok) continue;
      const histData = await histRes.json();
      
      if (histData[prompt_id]) {
        const outputs = histData[prompt_id].outputs;
        // Search through node outputs for images
        for (const nodeId in outputs) {
          if (outputs[nodeId].images && outputs[nodeId].images.length > 0) {
            const img = outputs[nodeId].images[0];
            return `${baseUrl}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`;
          }
        }
      }
    } catch(e) {
       console.error("Polling ComfyUI failed", e);
    }
  }
}

export async function generateFrameImage(
  description: string, 
  isHighQuality: boolean = false,
  globalStyle?: string,
  projectContext?: string,
  aspectRatio: string = "16:9"
): Promise<string> {
  // 指定使用最新的 Flash 生图系列 (2.5 / 3.1 预览版)
  const model = isHighQuality ? "gemini-3.1-flash-image-preview" : "gemini-2.5-flash-image";
  
  const prompt = `
    视觉创作指令 (Visual Directive):
    1. 风格总控 (Style): ${globalStyle || "Cinematic Movie, highly detailed concept art"}
    2. 项目一致性约束 (Consistency): ${projectContext || "Default cinematic settings"}
    3. 当前分镜描述 (Target): ${description}
    
    生成指令：请根据“项目一致性约束”中提到的角色和场景设定，结合“分镜描述”中的动作，以“风格总控”定义的艺术风格生成一张高质量图片。
  `.trim();
  
  const response = await ai.models.generateContent({
    model,
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any,
        ...(isHighQuality ? { imageSize: "1K" } : {}) // 1K resolution for HQ mode
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("Image generation failed");
}

export async function generateGridImage(
  frames: { number: number, description: string }[],
  isHighQuality: boolean = false,
  globalStyle?: string,
  projectContext?: string,
  aspectRatio: string = "16:9"
): Promise<string> {
  const model = isHighQuality ? "gemini-3.1-flash-image-preview" : "gemini-2.5-flash-image";
  
  const framesText = frames.map(f => `格 ${f.number}: ${f.description}`).join('\n');
  
  const prompt = `
    视觉创作指令 (Visual Directive):
    1. 风格总控 (Style): Professional Comic Book Template or Storyboard Grid, exactly 3x3 layout, ${globalStyle || "Cinematic Movie, highly detailed concept art"}
    2. 项目一致性约束及资产分析表 (Consistency & Assets): ${projectContext || "Default cinematic settings"}
    3. 九宫格各面版画面细节 (Panel Actions):
    ${framesText}
    
    专属生成指令：这是一张“九宫格分镜整合图”的请求。你必须且只能生成一张**单独的图片**。这张图片内部必须自带纵横分割线，精确布局成横排3列、竖排3行的九宫格(3x3)样式。
    在每个格子里，请【严格结合“项目一致性约束及资产分析表”中定义的人物外貌特征、服装、关键道具以及场景环境设定】，从左到右、从上到下按顺序绘制上述提到的9个剧情独立画面。确保九张分图中的人物和场景资产具备完全的一致性！
  `.trim();

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
        aspectRatio: "16:9",
        ...(isHighQuality ? { imageSize: "4K" } : {}) 
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("Grid image generation failed");
}
