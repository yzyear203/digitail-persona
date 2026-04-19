// 🌟 核心突破：向 Vercel 申请 60 秒的最大运行时间，防止大模型处理图片时超时被杀！
export const maxDuration = 60; 

export default async function handler(req, res) {
  // 仅允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只允许 POST 请求' });
  }

  try {
    const { messages } = req.body;
    // 从 Vercel 环境变量中读取豆包 API Key 和模型 ID
    const apiKey = process.env.DOUBAO_API_KEY;
    const modelId = process.env.DOUBAO_MODEL_ID;

    if (!apiKey || !modelId) {
      console.error("环境变量缺失: DOUBAO_API_KEY 或 DOUBAO_MODEL_ID 未配置");
      return res.status(500).json({ error: "服务器环境变量缺失，请检查 Vercel 配置" });
    }

    console.log(`[后端] 正在向火山引擎发送请求，模型: ${modelId}`);

    // 请求火山引擎（豆包）API
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: messages,
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[后端] 火山引擎 API 拒绝了请求:", errorData);
      return res.status(response.status).json({ error: errorData.error?.message || "大模型接口报错" });
    }

    const data = await response.json();
    console.log("[后端] 成功接收大模型返回数据");
    
    // 将大模型的回答返回给前端
    res.status(200).json(data);
    
  } catch (error) {
    console.error("[后端] 致命崩溃:", error);
    res.status(500).json({ error: error.message || "服务器内部网络错误" });
  }
}
