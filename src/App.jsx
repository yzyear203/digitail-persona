import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Fingerprint, Trash2, Clock, Info, Send, AlertTriangle, UserCircle, Sparkles, CheckSquare, UploadCloud, ArrowRight, Loader2, Terminal, FileText, Image as ImageIcon, BookOpen, Briefcase, Wand2, Scale, FileSignature } from 'lucide-react';

export default function DigitalPersonaApp() {
  const [appPhase, setAppPhase] = useState('home'); 
  const [authState, setAuthState] = useState('unauthorized'); 
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [showAddictionWarning, setShowAddictionWarning] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState([]);
  const [showTasksModal, setShowTasksModal] = useState(false);

  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);

  const [uploadedFiles, setUploadedFiles] = useState([]); 
  const [distillProgress, setDistillProgress] = useState(0);
  const [distillLogs, setDistillLogs] = useState([]);
  
  const [activePersona, setActivePersona] = useState("你是一个乐于助人的 AI 助手。"); 

  const messagesEndRef = useRef(null);
  const terminalEndRef = useRef(null);
  const fileInputRef = useRef(null); 
  
  const ANTI_ADDICTION_LIMIT = 720; 

  useEffect(() => {
    if (authState !== 'authorized') return;
    const timer = setInterval(() => {
      setSessionTime((prev) => {
        const newTime = prev + 1;
        if (newTime >= ANTI_ADDICTION_LIMIT && newTime % ANTI_ADDICTION_LIMIT === 0) {
          setShowAddictionWarning(true);
        }
        return newTime;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [authState]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [distillLogs]);

  const handleAgreeAndProceed = () => {
    setShowAgreementModal(false);
    setAppPhase('auth');
  };

  const handleSimulateAuth = () => {
    setAuthState('authenticating');
    setTimeout(() => {
      setAuthState('authorized');
      setAppPhase('dashboard');
    }, 2000);
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const newFiles = await Promise.all(files.map(async (f) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          const isImage = f.type.startsWith('image/');
          const isText = f.name.endsWith('.txt') || f.type === 'text/plain';

          reader.onloadend = () => {
            let base64String = null;
            let textContent = null;
            
            if (isImage) {
              base64String = reader.result.split(',')[1];
            } else if (isText) {
              textContent = reader.result;
            }

            resolve({
              name: f.name,
              type: isImage ? 'img' : 'doc',
              size: (f.size / 1024 / 1024).toFixed(2) + ' MB',
              mimeType: f.type || 'application/octet-stream',
              base64Data: base64String,
              textContent: textContent,
              isImage: isImage,
              isText: isText
            });
          };

          if (isImage) reader.readAsDataURL(f);
          else if (isText) reader.readAsText(f);
          else {
            resolve({
              name: f.name, type: 'doc', size: (f.size / 1024 / 1024).toFixed(2) + ' MB',
              isImage: false, isText: false, warning: "暂仅支持图片与txt文本的深度解析"
            });
          }
        });
      }));
      setUploadedFiles(prev => [...prev, ...newFiles]);
    }
  };

  // 🌟 核心重构：调用自己的 Vercel 后端接口 (安全全栈模式)
  const callDoubaoAPI = async (promptText, systemInstructionText = null, isJson = false, imageParts = []) => {
    // 构造标准的 OpenAI 消息数组
    let messages = [];

    // 1. 注入 System Prompt
    if (systemInstructionText) {
      messages.push({ role: "system", content: systemInstructionText });
    }

    // 2. 构造 User Prompt（支持多模态图片）
    let userContent = [];
    if (imageParts.length > 0) {
      userContent.push({ type: "text", text: promptText });
      imageParts.forEach(img => {
        userContent.push({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${img.base64Data}` }
        });
      });
      messages.push({ role: "user", content: userContent });
    } else {
      messages.push({ role: "user", content: promptText });
    }

    // 🌟 核心修改 1：指向我们在 api/generate.js 里写的后端管家接口
    const url = `/api/generate`;

    // 🌟 核心修改 2：只把组装好的 messages 传给后端，不再传密钥和模型ID
    const payload = {
      messages: messages
    };

    const fetchWithRetry = async (retries = 3, delay = 1000) => {
      for (let i = 0; i < retries; i++) {
        try {
          const response = await fetch(url, { 
            method: "POST", 
            headers: { 
              "Content-Type": "application/json"
              // 🌟 核心修改 3：移除了 "Authorization: Bearer ..."，前端彻底交出钥匙！
            }, 
            body: JSON.stringify(payload) 
          });
          
          if (!response.ok) {
            const errData = await response.json();
            throw new Error(`后端 API 报错: ${errData.error || response.status}`);
          }
          return await response.json();
        } catch (e) {
          if (i === retries - 1) throw e;
          await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
        }
      }
    };

    const data = await fetchWithRetry();
    return data.choices?.[0]?.message?.content || "";
  };

  const handleStartDistillation = async () => {
    setAppPhase('distilling');
    setDistillLogs(["[系统就绪] 开始建立火山引擎算力连接..."]);
    setDistillProgress(5);

    try {
      // 准备图片数据
      const imageParts = uploadedFiles
        .filter(f => f.isImage && f.base64Data)
        .map(f => ({ mimeType: f.mimeType, base64Data: f.base64Data }));

      const textContents = uploadedFiles
        .filter(f => f.isText && f.textContent)
        .map(f => `【${f.name} 的内容】:\n${f.textContent}`)
        .join('\n\n');

      setDistillLogs(prev => [...prev, `[解析层] 成功加载 ${imageParts.length} 张图片和 ${textContents.length > 0 ? '文本数据' : '0 份文本'}。`]);
      setDistillProgress(25);

      setTimeout(() => {
        setDistillLogs(prev => [...prev, "[深度推理] 注入豆包视觉大模型，执行深度 OCR 与排版心理学提炼..."]);
        setDistillProgress(50);
      }, 1000);

      let prompt = `用户上传了上述包含真实聊天记录或备忘录内容的图片/截图。
请你利用视觉理解和 OCR 能力，阅读图片中的对话内容。
你需要根据这些最真实的原始文本，提炼出这个人的数字人格设定。
请用第一人称（“我”）来回答，包含以下必须项：
1. 核心性格与沟通风格。
2. 常用的口头禅或惯用语（摘抄原话）。
3. 展现出的处理事务逻辑。
4. 发消息的节奏风格。
5. 连发条数心理边界（如：习惯连续发 2-4 条，或者 4-8 条）。必须在设定中明确写出数字范围！`;

      if (textContents) {
        prompt = `这里还有一些文本文档真实内容供参考：\n\n${textContents}\n\n` + prompt;
      }

      if (imageParts.length === 0 && !textContents) {
         prompt = "用户没有上传有效素材，请随机生成一个标准的暴躁老哥 AI 助手人格设定。";
      }

      const generatedPersona = await callDoubaoAPI(prompt, "你是一个擅长提炼人类心理学和行为特征的架构师。", false, imageParts);
      
      setDistillLogs(prev => [...prev, "[算力释放] 豆包模型映射完成！已成功提取核心词汇与发消息习惯。"]);
      setDistillProgress(80);
      setActivePersona(generatedPersona);

      setTimeout(() => {
        setDistillLogs(prev => [...prev, "[编译成功] 模型处理完毕！正在挂载底层对话引擎..."]);
        setDistillProgress(100);
        
        setTimeout(() => {
          setMessages([
            { id: 1, role: 'system', text: '已通过火山引擎认证。基于您上传的真实素材解析完毕，处于【自主人格】接管模式。', time: new Date().toLocaleTimeString() },
            { id: 2, role: 'assistant', text: `您好，我已经完全阅读并理解了您上传的截图或文字内容。我已经复刻了您的语言习惯和思考方式，现在我是您的数字分身，有什么需要代劳的吗？`, time: new Date().toLocaleTimeString() }
          ]);
          setAppPhase('chat');
        }, 1500);
      }, 1000);

    } catch (error) {
      console.error(error);
      setDistillLogs(prev => [...prev, `[致命错误] API 请求失败，请检查后端或网络状态: ${error.message}`]);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || showAddictionWarning) return;

    const userText = input;
    const newMsg = { id: Date.now(), role: 'user', text: userText, time: new Date().toLocaleTimeString() };
    setMessages((prev) => [...prev, newMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const chatHistory = messages
        .filter(m => m.role !== 'system')
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
        .join('\n');
      const prompt = `对话历史:\n${chatHistory}\n\nUser: ${userText}\nAssistant:`;
      
      const systemInstruction = `你是一个数字备份人格。请严格遵循以下你在被深度解析后生成的身份设定：\n\n${activePersona}\n\n
请用这个身份、第一人称代替用户处理事务，一定要表现出上面设定里的性格和口语习惯。
【关键指令 - 模仿打字节奏与条数心理边界】：
1. 如果你在设定中是【长篇大论】（单次1条）的风格，直接输出完整文字，不要使用 "|||"。
2. 如果你是【连续发送多条短消息】的风格，请根据设定的【连发条数范围】随机决定本次回复切成 N 条。
3. 强制执行切分：将回复切分为刚好 N 个短句，并严格使用 "|||" 作为分隔符（例如：好的|||我现在就看|||五分钟后给你结果）。`;

      const responseText = await callDoubaoAPI(prompt, systemInstruction);

      const replyParts = responseText.split('|||').map(s => s.trim()).filter(s => s);
      
      for (let i = 0; i < replyParts.length; i++) {
        if (i > 0) {
          const delayTime = Math.min(10000, Math.max(1500, replyParts[i].length * 250));
          await new Promise(resolve => setTimeout(resolve, delayTime));
        }

        setMessages((prev) => [
          ...prev,
          { id: Date.now() + i, role: 'assistant', text: replyParts[i], time: new Date().toLocaleTimeString() }
        ]);
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), role: 'assistant', text: "[系统异常] 后端服务连接遇到干扰，模型调用失败。", time: new Date().toLocaleTimeString() }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleExtractTasks = async () => {
    setIsExtracting(true);
    try {
      const chatHistory = messages
        .filter(m => m.role !== 'system')
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
        .join('\n');
      
      const prompt = `分析以下对话记录，提取出所有需要由用户或数字人执行的“代办事项(Action Items)”。如果没有，请返回空数组。\n\n对话记录:\n${chatHistory}`;
      const systemInstruction = `你是一个任务提取助手。请仅输出合法的 JSON 对象，格式要求：{"tasks": ["任务1", "任务2"]}。`;

      const jsonResponse = await callDoubaoAPI(prompt, systemInstruction, true);
      const parsed = JSON.parse(jsonResponse);
      const tasks = parsed.tasks || [];
      
      setExtractedTasks(Array.isArray(tasks) ? tasks : []);
      setShowTasksModal(true);
    } catch (error) {
      console.error(error);
      alert("✨ 提炼代办事项失败，请检查终端报错。");
    } finally {
      setIsExtracting(false);
    }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (appPhase === 'home') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center pt-20 pb-10 px-6 font-sans">
        <div className="bg-indigo-100 text-indigo-800 px-4 py-2 text-xs flex items-center justify-center space-x-2 rounded-full mb-12 shadow-sm border border-indigo-200">
          <ShieldCheck className="w-4 h-4" />
          <span className="font-semibold">2026 合规运作中</span>
          <span>已接入火山引擎 (Doubao) 底座及 PIPL 隐私保护层</span>
        </div>

        <div className="max-w-5xl w-full text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
            Identity as a Skill (IaaS)<br/>
            <span className="text-indigo-600">数字资产编译器</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            基于豆包视觉与推理引擎双擎驱动。只需上传对话片段，即刻提取记忆、经验与思考模型。
          </p>
        </div>

        <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-xl transition-all group flex flex-col">
            <div className="bg-amber-100 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <BookOpen className="w-7 h-7 text-amber-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">名人人格/思想库</h3>
            <p className="text-sm text-slate-500 mb-8 flex-1 leading-relaxed">
              连接公共版权领域的专家、名人思想数据库进行沉浸式的互动知识学习。
            </p>
            <button onClick={() => alert('提示：当前为演示环境。')} className="w-full py-3 rounded-xl font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors">
              进入版权库
            </button>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-xl transition-all group flex flex-col">
            <div className="bg-emerald-100 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Briefcase className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">企业工作继任者</h3>
            <p className="text-sm text-slate-500 mb-8 flex-1 leading-relaxed">
              对接企业钉钉/飞书组织架构。蒸馏离职或调岗员工的业务 SOP，防止资产流失。
            </p>
            <button onClick={() => alert('提示：需连接企业内控 OA 系统。')} className="w-full py-3 rounded-xl font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors">
              OA 授权登入
            </button>
          </div>

          <div className="bg-white rounded-3xl p-8 border-2 border-indigo-500 shadow-md hover:shadow-2xl transition-all group flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">推荐体验</div>
            <div className="bg-indigo-100 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Wand2 className="w-7 h-7 text-indigo-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">任意模拟数字人</h3>
            <p className="text-sm text-slate-500 mb-8 flex-1 leading-relaxed">
              上传微信截图、备忘录等素材，通过多模态 AI 一键“蒸馏”性格与记忆。
            </p>
            <button onClick={() => setShowAgreementModal(true)} className="w-full py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-colors flex justify-center items-center space-x-2">
              <span>立即创建分身</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showAgreementModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
              <div className="flex items-center space-x-3 mb-6 text-slate-800 border-b border-slate-100 pb-4">
                <div className="bg-slate-100 p-3 rounded-full">
                  <Scale className="w-6 h-6 text-slate-700" />
                </div>
                <h2 className="text-2xl font-bold">数字人提取授权及免责协议</h2>
              </div>
              <div className="flex-1 overflow-y-auto pr-4 space-y-4 text-sm text-slate-600 leading-relaxed mb-6">
                <p>尊敬的用户，继续操作前，请您务必仔细阅读并同意以下条款：</p>
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 font-medium">
                  <h4 className="flex items-center mb-2"><AlertTriangle className="w-4 h-4 mr-2"/> 知情同意声明</h4>
                  <p className="text-xs">本平台仅提供 AI 算力。您上传包含他人发言截图等数据时，<strong>必须已事先充分征得本人明确同意。</strong></p>
                </div>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>责任隔离：</strong>若未经同意擅自提取引发纠纷，均由您全权承担，与平台无关。</li>
                  <li><strong>数据销毁：</strong>平台承诺不长期留存素材，模型蒸馏完毕后即刻物理销毁。</li>
                </ul>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <label className="flex items-start space-x-3 cursor-pointer group mb-6">
                  <input type="checkbox" checked={isAgreed} onChange={(e) => setIsAgreed(e.target.checked)} className="mt-1 w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"/>
                  <span className="text-sm text-slate-700 group-hover:text-slate-900 select-none">
                    我已仔细阅读并同意上述协议。我在此承诺：<br/><strong className="text-indigo-700">我已获得合法授权。</strong>
                  </span>
                </label>
                <div className="flex space-x-3">
                  <button onClick={() => { setShowAgreementModal(false); setIsAgreed(false); }} className="flex-1 py-3 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">取消</button>
                  <button onClick={handleAgreeAndProceed} disabled={!isAgreed} className="flex-1 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex justify-center items-center space-x-2">
                    <FileSignature className="w-5 h-5" /><span>同意并进入验证</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (appPhase === 'auth') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full rounded-2xl shadow-xl overflow-hidden border border-slate-200 animate-fade-in">
          <div className="bg-blue-600 p-6 text-center text-white">
            <ShieldCheck className="w-16 h-16 mx-auto mb-4 text-blue-100" />
            <h1 className="text-2xl font-bold">操作者身份核验</h1>
          </div>
          <div className="p-8 text-center space-y-6">
            <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm text-left flex items-start space-x-3">
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>为记录协议签署主体，请确保由您本人操作。</p>
            </div>
            <button onClick={handleSimulateAuth} disabled={authState === 'authenticating'} className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-medium transition-all disabled:opacity-50 shadow-md">
              {authState === 'authenticating' ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : <><Fingerprint className="w-6 h-6" /><span>唤起指纹/面容安全通道</span></>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (appPhase === 'dashboard') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-3xl w-full">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">个人数字资产工作台</h1>
            <p className="text-slate-500">上传真实对话截图或文本文件，AI将自动“看”懂内容并提取性格</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
            <div className="p-8 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                <ImageIcon className="w-5 h-5 mr-2 text-indigo-500" /> 
                注入多元素材 (支持JPG/PNG截图 或 TXT文档)
              </h2>
              <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.jpg,.jpeg,.png"/>
              <div className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${uploadedFiles.length > 0 ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`} onClick={() => fileInputRef.current?.click()}>
                {uploadedFiles.length > 0 ? (
                  <div className="flex flex-col items-center text-indigo-600">
                    <CheckSquare className="w-12 h-12 mb-3" />
                    <div className="flex flex-col items-center space-y-2 mb-1">
                      {uploadedFiles.map((f, i) => (
                        <span key={i} className="font-semibold text-md flex items-center">
                          {f.type === 'doc' ? <FileText className="w-4 h-4 mr-2" /> : <ImageIcon className="w-4 h-4 mr-2" />}
                          {f.name} <span className="text-xs text-indigo-400 ml-2">({f.size})</span>
                          {f.warning && <span className="text-xs text-amber-500 ml-2 border border-amber-200 bg-amber-50 px-1 rounded">{f.warning}</span>}
                        </span>
                      ))}
                    </div>
                    <span className="text-sm opacity-80 mt-2">真实底层数据流已捕获，可提交进行 OCR 解析</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-slate-500">
                    <UploadCloud className="w-12 h-12 mb-3 text-slate-400" />
                    <span className="font-medium text-slate-700">点击上传真实的聊天截图(图片) 或 .txt纯文本</span>
                  </div>
                )}
              </div>
            </div>
            <div className="p-8 bg-slate-50">
              <button onClick={handleStartDistillation} disabled={uploadedFiles.length === 0} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg">
                <span>请求火山引擎进行人格蒸馏</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (appPhase === 'distilling') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-300 flex items-center justify-center p-6 font-mono">
        <div className="max-w-2xl w-full">
          <div className="flex items-center space-x-3 mb-6">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <h1 className="text-2xl font-bold text-white">Volcengine Distillation</h1>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
            <div className="h-2 bg-slate-700 w-full">
              <div className="h-full bg-indigo-500 transition-all duration-500 ease-out relative" style={{ width: `${distillProgress}%` }}>
                <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>
            <div className="p-6 h-[400px] overflow-y-auto text-sm space-y-3">
              {distillLogs.map((log, idx) => (
                <div key={idx} className={`${log.includes('OCR') ? 'text-amber-400/90 pl-4 border-l-2 border-amber-500/50' : log.includes('成功') ? 'text-green-400 font-bold' : log.includes('错误') ? 'text-red-400' : ''}`}>
                  <span className="text-slate-500 mr-3">[{new Date().toLocaleTimeString()}]</span>{log}
                </div>
              ))}
              {distillProgress < 100 && (
                <div className="flex items-center text-indigo-400 mt-2"><Terminal className="w-4 h-4 mr-2" /><span className="animate-pulse">_</span></div>
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <div className="bg-amber-100 text-amber-800 px-4 py-2 text-xs flex items-center justify-center space-x-2 border-b border-amber-200 z-50 fixed top-0 w-full">
        <AlertTriangle className="w-4 h-4" />
        <span className="font-semibold">合规提示：</span>
        <span>交互对象为豆包大模型生成的【数字人物】，不代表真实个人意愿。</span>
      </div>

      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between mt-8 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-full"><UserCircle className="w-6 h-6 text-blue-600" /></div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">自定义数字分身 (豆包驱动版)</h1>
            <div className="flex items-center space-x-2 text-xs text-slate-500">
              <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> 会话: {formatTime(sessionTime)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={handleExtractTasks} disabled={isExtracting || messages.length <= 2} className="flex items-center space-x-1 text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg text-sm transition-colors border border-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed">
            {isExtracting ? <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div> : <Sparkles className="w-4 h-4" />}
            <span className="font-medium">✨ 智能提炼代办</span>
          </button>
          <button onClick={() => setShowDeleteModal(true)} className="flex items-center space-x-1 text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg text-sm transition-colors border border-red-100">
            <Trash2 className="w-4 h-4" /><span>行使被遗忘权</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            {msg.role === 'system' ? (
               <div className="mx-auto bg-slate-200 text-slate-600 text-xs py-1 px-4 rounded-full my-4">{msg.text}</div>
            ) : (
              <div className={`max-w-[70%] rounded-2xl px-5 py-3 shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none'}`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                <span className={`text-[10px] mt-2 block ${msg.role === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>{msg.time} {msg.role === 'assistant' && ' • AI 生成'}</span>
              </div>
            )}
          </div>
        ))}
        {isTyping && (
           <div className="flex items-start">
             <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-none px-5 py-4 shadow-sm flex space-x-2">
               <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
               <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
               <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="bg-white border-t border-slate-200 p-4 pb-8">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex space-x-4">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} disabled={showAddictionWarning} placeholder="与数字分身对话..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors disabled:bg-slate-100" />
          <button type="submit" disabled={!input.trim() || showAddictionWarning} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 disabled:opacity-50">
            <Send className="w-6 h-6" />
          </button>
        </form>
      </footer>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center space-x-3 text-red-600 mb-4"><AlertTriangle className="w-8 h-8" /><h2 className="text-xl font-bold">终止连接？</h2></div>
            <p className="text-sm text-slate-600 mb-6">系统将彻底擦除设定，并退回大厅。</p>
            <div className="flex space-x-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 bg-slate-100 py-3 rounded-xl hover:bg-slate-200">取消</button>
              <button onClick={() => window.location.reload()} className="flex-1 bg-red-600 text-white py-3 rounded-xl hover:bg-red-700">确认</button>
            </div>
          </div>
        </div>
      )}

      {showTasksModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-indigo-600 flex items-center"><CheckSquare className="w-6 h-6 mr-2" />已提炼代办</h2>
            </div>
            <div className="space-y-3 mb-6 max-h-[40vh] overflow-y-auto">
              {extractedTasks.length === 0 ? <p className="text-sm text-slate-500 text-center py-6">未检测到代办事项。</p> : extractedTasks.map((t, i) => (
                <label key={i} className="flex items-start space-x-3 bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-indigo-200 cursor-pointer">
                  <input type="checkbox" className="mt-0.5 rounded text-indigo-600" /><span className="text-sm text-slate-700">{t}</span>
                </label>
              ))}
            </div>
            <button onClick={() => setShowTasksModal(false)} className="w-full bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700">关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}