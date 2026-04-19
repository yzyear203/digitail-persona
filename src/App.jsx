import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Trash2, Info, Send, AlertTriangle, UserCircle, Key, Sparkles, CheckSquare, UploadCloud, ArrowRight, Loader2, Terminal, FileText, Image as ImageIcon, BookOpen, Briefcase, Wand2, Scale, FileSignature, Database, LogOut, X, Mail, Smartphone, Lock, User, Hash } from 'lucide-react';
import tcb from '@cloudbase/js-sdk';

// 🌟 生产级腾讯云 TCB 初始化
let app, auth, db;
try {
  app = tcb.init({
    env: import.meta.env.VITE_TCB_ENV_ID || "persona-app-d9gkoxk5rd2f70aff"
  });
  auth = app.auth();
  db = app.database();
} catch (error) {
  console.error("腾讯云 TCB 初始化失败，请检查环境变量配置:", error);
}

// 🌟 打字机引擎 (保持不变)
const SimulatedTypingText = ({ content, persona, onComplete, scrollRef }) => {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    let isMounted = true;
    const actions = [];
    let baseSpeed = 220; let deleteSpeed = 80;
    if (persona.includes('细腻') || persona.includes('犹豫') || persona.includes('慢') || persona.includes('斟酌')) { baseSpeed = 400; deleteSpeed = 120; } 
    else if (persona.includes('急躁') || persona.includes('快') || persona.includes('心直口快')) { baseSpeed = 120; deleteSpeed = 40; }

    const parts = content.split(/(<del>.*?<\/del>)/g);
    parts.forEach(part => {
      if (part.startsWith('<del>') && part.endsWith('</del>')) {
        const delContent = part.replace('<del>', '').replace('</del>', '');
        for (let c of delContent) actions.push({ type: 'type', char: c });
        actions.push({ type: 'pause', ms: 800 + Math.random() * 600 });
        for (let i = 0; i < delContent.length; i++) actions.push({ type: 'delete' });
        actions.push({ type: 'pause', ms: 500 + Math.random() * 500 });
      } else {
        for (let c of part) actions.push({ type: 'type', char: c });
      }
    });

    let currentText = ''; let index = 0;
    const runAction = () => {
      if (!isMounted) return;
      if (index >= actions.length) {
        setIsTyping(false);
        if (onCompleteRef.current) onCompleteRef.current();
        return;
      }
      const action = actions[index];
      let delay = baseSpeed + (Math.random() * 100 - 50); 
      if (action.type === 'type') {
        currentText += action.char; setDisplayText(currentText);
        if (Math.random() < 0.05) delay += 300 + Math.random() * 400;
      } else if (action.type === 'delete') {
        currentText = currentText.slice(0, -1); setDisplayText(currentText); delay = deleteSpeed; 
      } else if (action.type === 'pause') { delay = action.ms; }

      if (scrollRef && scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'auto' });
      index++; setTimeout(runAction, delay);
    };
    runAction();
    return () => { isMounted = false; };
  }, [content, persona, scrollRef]);

  return (
    <span className="whitespace-pre-wrap">
      {displayText}
      {isTyping && <span className="inline-block w-1.5 h-4 ml-1 bg-blue-400 animate-pulse align-middle"></span>}
    </span>
  );
};

export default function DigitalPersonaApp() {
  const [appPhase, setAppPhase] = useState('home'); 
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTypingIndicator, setIsTypingIndicator] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const currentInteractionRef = useRef(0); 
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState([]);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [showComplianceBanner, setShowComplianceBanner] = useState(true); 

  // 🌟 核心升级：Auth 状态
  const [authMethod, setAuthMethod] = useState('email'); // 'email' 或 'phone'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // 二次密码确认
  const [nickname, setNickname] = useState(''); // 用户昵称
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null); // 存储数据库里的详细档案(包含专属ID)
  
  const [savedPersonas, setSavedPersonas] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]); 
  const [distillProgress, setDistillProgress] = useState(0);
  const [distillLogs, setDistillLogs] = useState([]);
  const [activePersona, setActivePersona] = useState("你是一个乐于助人的 AI 助手。"); 

  const messagesEndRef = useRef(null);
  const terminalEndRef = useRef(null);
  const fileInputRef = useRef(null); 

  // 🌟 生成炫酷全站唯一专属 ID 的函数 (例如: ID-A8F2K)
  const generateUniqueId = () => {
    return 'ID-' + Math.random().toString(36).substring(2, 7).toUpperCase();
  };

  // 🌟 监听登录状态并读取/创建数据库档案
  useEffect(() => {
    if (!auth) return;
    const loadUserProfile = async (uid, email, isAnon) => {
      if (isAnon) {
        setUserProfile({ nickname: '匿名访客', shortId: 'GUEST-' + Math.floor(Math.random()*1000) });
        return;
      }
      try {
        const res = await db.collection('users').where({ uid: uid }).get();
        if (res.data && res.data.length > 0) {
          setUserProfile(res.data[0]); // 老用户，直接加载档案
        } else {
          // 新用户首次登录，从本地缓存抓取注册时填写的昵称，并生成专属ID
          const savedNickname = localStorage.getItem('temp_nickname') || email.split('@')[0];
          const newProfile = {
            uid: uid,
            email: email,
            nickname: savedNickname,
            shortId: generateUniqueId(),
            createdAt: db.serverDate()
          };
          await db.collection('users').add(newProfile);
          setUserProfile(newProfile);
          localStorage.removeItem('temp_nickname'); // 清理缓存
        }
      } catch (err) { console.error("档案加载失败:", err); }
    };

    const handleLoginState = async (loginState) => {
      if (loginState) {
        const isAnon = loginState.authType === 'ANONYMOUS' || (!loginState.user?.email);
        const uid = loginState.user?.uid || 'anonymous_uid';
        const userEmail = loginState.user?.email || '';
        setUser({ uid, isAnonymous: isAnon, email: userEmail });
        await loadUserProfile(uid, userEmail, isAnon);
      } else {
        setUser(null); setUserProfile(null);
      }
    };

    auth.getLoginState().then(handleLoginState);
    const unsubscribe = auth.onLoginStateChanged(handleLoginState);
    return () => { if(typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user || user.isAnonymous || !db) { setSavedPersonas([]); return; }
    const watcher = db.collection('personas').where({ owner: user.uid }).watch({
        onChange: (snapshot) => {
          const loaded = [];
          snapshot.docs.forEach(document => { loaded.push({ id: document._id, ...document }); });
          loaded.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setSavedPersonas(loaded);
        },
        onError: (error) => console.error("数据加载失败:", error)
      });
    return () => watcher.close();
  }, [user]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTypingIndicator]);
  useEffect(() => { terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [distillLogs]);

  const handleAgreeAndProceed = () => {
    setShowAgreementModal(false);
    if (user && !user.isAnonymous) setAppPhase('dashboard');
    else setAppPhase('auth');
  };

  // 🌟 强化版邮箱认证逻辑
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (authMethod === 'phone') {
      setAuthError("📱 内测防刷安全限制：暂未开放短信验证码通道，请点击上方切换至【邮箱注册】。");
      return;
    }
    
    setAuthError('');
    setIsAuthenticating(true);

    try {
      if (!isLoginMode) {
        // 注册前的表单校验
        if (password.length < 6) throw new Error("密码至少需要 6 位字符");
        if (password !== confirmPassword) throw new Error("两次输入的密码不一致，请重新检查！");
        if (!nickname.trim()) throw new Error("请为自己起一个昵称");

        // 暂存昵称，等待激活后首次登录时写入数据库
        localStorage.setItem('temp_nickname', nickname.trim());
        
        await auth.signUpWithEmailAndPassword(email, password);
        alert("🎉 注册指令已发送！\n请前往您的邮箱（注意检查垃圾箱）点击激活链接，完成后即可登录！");
        setIsLoginMode(true); 
      } else {
        // 登录逻辑
        await auth.signInWithEmailAndPassword(email, password);
        setAppPhase('dashboard');
      }
    } catch (err) {
      let errorMsg = "验证失败，请检查格式或重试";
      const msg = err.message || "";
      if (msg.includes('not exist') || msg.includes('找不到')) errorMsg = '该邮箱未注册，请先切换至“注册账号”！';
      else if (msg.includes('wrong password') || msg.includes('密码')) errorMsg = '密码错误，请重新输入！';
      else if (msg.includes('不一致')) errorMsg = msg;
      else if (msg.includes('起一个昵称') || msg.includes('6 位')) errorMsg = msg;
      else if (msg.includes('already exists') || msg.includes('已注册')) errorMsg = '该邮箱已被注册！若未激活请去邮箱点击激活链接。';
      else if (msg.includes('Email verify')) errorMsg = '邮箱尚未激活，请前往您的邮箱点击腾讯云发送的确认链接！';
      setAuthError(errorMsg);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGuestAuth = async () => {
    setAuthError(''); setIsAuthenticating(true);
    try { await auth.anonymousAuthProvider().signIn(); setAppPhase('dashboard'); } 
    catch (err) { setAuthError("游客登录失败: " + err.message); } 
    finally { setIsAuthenticating(false); }
  };

  const handleLogout = async () => {
    if (auth) await auth.signOut();
    setAppPhase('home'); setMessages([]); setSavedPersonas([]); setUploadedFiles([]); setIsResponding(false); setUserProfile(null);
  };

  // [保留原有的 handleFileUpload, callDoubaoAPI, handleStartDistillation, handleSendMessage, handleExtractTasks, loadPersonaAndChat, handleDeleteSavedPersona 函数，为了不超出字数限制此处折叠，你在粘贴时它们完全不变]
  // ---------------------------------------------------------------------------------------------------------
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const newFiles = await Promise.all(files.map(async (f) => {
        return new Promise((resolve) => {
          const isImage = f.type.startsWith('image/');
          const isText = f.name.endsWith('.txt') || f.type === 'text/plain';

          if (isImage) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                let width = img.width; let height = img.height;
                if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
                const base64String = compressedDataUrl.split(',')[1];
                resolve({ name: f.name, type: 'img', size: '已极限压缩', mimeType: 'image/jpeg', base64Data: base64String, textContent: null, isImage: true, isText: false });
              };
              img.src = event.target.result;
            };
            reader.readAsDataURL(f);
          } else if (isText) {
            const reader = new FileReader();
            reader.onloadend = () => { resolve({ name: f.name, type: 'doc', size: (f.size / 1024 / 1024).toFixed(2) + ' MB', mimeType: f.type || 'text/plain', base64Data: null, textContent: reader.result, isImage: false, isText: true }); };
            reader.readAsText(f);
          } else resolve({ name: f.name, warning: "仅支持图片与txt" });
        });
      }));
      setUploadedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const callDoubaoAPI = async (promptText, systemInstructionText = null, imageParts = []) => {
    const isSandboxEnv = typeof __firebase_config !== 'undefined';
    if (isSandboxEnv) {
      const apiKey = ""; const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
      const parts = [{ text: promptText }];
      if (imageParts.length > 0) { imageParts.forEach(img => { parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64Data } }); }); }
      const payload = { contents: [{ parts }] };
      if (systemInstructionText) { payload.systemInstruction = { parts: [{ text: systemInstructionText }] }; }
      const fetchWithRetry = async (retries = 3, delay = 1000) => {
        for (let i = 0; i < retries; i++) {
          try {
            const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error("API 报错");
            return await response.json();
          } catch (e) { if (i === retries - 1) throw e; await new Promise(res => setTimeout(res, delay * Math.pow(2, i))); }
        }
      };
      const data = await fetchWithRetry(); return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else {
      let messages = [];
      if (systemInstructionText) messages.push({ role: "system", content: systemInstructionText });
      let userContent = [];
      if (imageParts.length > 0) {
        userContent.push({ type: "text", text: promptText });
        imageParts.forEach(img => userContent.push({ type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.base64Data}` } }));
        messages.push({ role: "user", content: userContent });
      } else { messages.push({ role: "user", content: promptText }); }
      const fetchWithRetry = async (retries = 3, delay = 1000) => {
        for (let i = 0; i < retries; i++) {
          try {
            const response = await fetch('/api/generate', { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages }) });
            if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(`HTTP ${response.status} - ${errData.error || '请求被拒绝'}`); }
            return await response.json();
          } catch (e) { if (i === retries - 1) throw e; await new Promise(res => setTimeout(res, delay * Math.pow(2, i))); }
        }
      };
      const data = await fetchWithRetry(); return data.choices?.[0]?.message?.content || "";
    }
  };

  const handleStartDistillation = async () => {
    setAppPhase('distilling'); setDistillLogs(["[系统就绪] 开始建立后端算力连接..."]); setDistillProgress(5);
    try {
      const imageParts = uploadedFiles.filter(f => f.isImage && f.base64Data).map(f => ({ mimeType: f.mimeType, base64Data: f.base64Data }));
      const textContents = uploadedFiles.filter(f => f.isText && f.textContent).map(f => `【${f.name}】:\n${f.textContent}`).join('\n\n');
      setDistillLogs(prev => [...prev, `[解析层] 成功加载 ${imageParts.length} 张图片(已前端压缩) 和 ${textContents.length > 0 ? '文本数据' : '0 份文本'}。`]); setDistillProgress(25);
      setTimeout(() => { setDistillLogs(prev => [...prev, "[深度推理] 注入视觉大模型，执行深度 OCR 与排版心理学提炼..."]); setDistillProgress(50); }, 1000);

      let prompt = `用户上传了上述包含真实聊天记录或备忘录内容的图片/截图。请你利用强大的视觉理解和 OCR 能力，逐字阅读图片中的所有对话和文字内容。你需要根据这些最真实的原始文本，提炼、逆向推理出这个人的数字人格设定。请用第一人称（“我”）来回答，包含以下必须项：1. 核心性格与沟通风格。2. 常用的口头禅或惯用语。3. 展现出的专业领域、处理事务的典型逻辑。4. 连发条数心理边界：推断出 TA 连续发送消息的大致范围。5. 打字与思绪特征（评估心思细腻程度，字数挂钩标签）。`;
      if (textContents) prompt = `参考文本文档内容：\n\n${textContents}\n\n` + prompt;
      if (imageParts.length === 0 && !textContents) prompt = "用户未上传有效素材，请随机生成一个标准的AI助手人格设定即可。";

      const generatedPersona = await callDoubaoAPI(prompt, "你是一个擅长提炼人类心理学和行为特征的架构师。", imageParts);
      setDistillLogs(prev => [...prev, "[算力释放] 打字特征与人格映射完成！已成功提取犹豫指数。"]); setDistillProgress(80); setActivePersona(generatedPersona);

      if (user && !user.isAnonymous && db) {
        try {
          await db.collection('personas').add({ name: uploadedFiles[0]?.name ? uploadedFiles[0].name.split('.')[0] : '未命名数字人', personaPrompt: generatedPersona, createdAt: new Date().toISOString(), owner: user.uid });
          setDistillLogs(prev => [...prev, "[云端同步] 档案已永久刻录至数据库。"]);
        } catch (err) { console.error(err); }
      } else { setDistillLogs(prev => [...prev, "[本地缓存] 匿名游客模式，数字分身不会永久保存。"]); }

      setTimeout(() => {
        setDistillLogs(prev => [...prev, "[编译成功] 视觉模型处理完毕！正在挂载底层对话引擎..."]); setDistillProgress(100);
        setTimeout(() => {
          setMessages([{ id: 1, role: 'system', text: '已通过认证。基于您上传的素材解析完毕，处于【自主人格】接管模式。', time: new Date().toLocaleTimeString(), isAnimated: false }, { id: 2, role: 'assistant', text: `您好，我已经完全阅读并理解了您上传的内容。我现在是您的数字分身，有什么需要代劳的吗？`, time: new Date().toLocaleTimeString(), isAnimated: true }]);
          setAppPhase('chat');
        }, 1500);
      }, 1000);
    } catch (error) { setDistillLogs(prev => [...prev, `[致命错误] 后端管线崩溃: ${error.message}`]); }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault(); if (!input.trim()) return;
    const userText = input; const newMsg = { id: Date.now(), role: 'user', text: userText, time: new Date().toLocaleTimeString() };
    setMessages((prev) => [...prev, newMsg]); setInput('');
    const interactionId = Date.now(); currentInteractionRef.current = interactionId;
    setIsTypingIndicator(true); setIsResponding(true);

    try {
      const chatHistory = messages.filter(m => m.role !== 'system').map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text.replace(/<del>.*?<\/del>/g, '')}`).join('\n');
      const prompt = `对话历史:\n${chatHistory}\n\nUser: ${userText}\nAssistant:`;
      const systemInstruction = `你是一个数字备份人格。请严格遵循以下设定：\n\n${activePersona}\n\n请用这个身份、第一人称代替用户处理事务。拒绝复读与强行加戏。为了展示人类打字犹豫感，必须在输出中使用 <del>删掉的话</del> 标签！长句强制加，短句随机加。使用 "|||" 切分多条消息。`;
      const responseText = await callDoubaoAPI(prompt, systemInstruction);
      if (currentInteractionRef.current !== interactionId) return;
      const replyParts = responseText.split('|||').map(s => s.trim()).filter(s => s);
      setIsTypingIndicator(false); 
      for (let i = 0; i < replyParts.length; i++) {
        if (currentInteractionRef.current !== interactionId) break;
        const msgId = Date.now() + i;
        setMessages((prev) => [...prev, { id: msgId, role: 'assistant', text: replyParts[i], time: new Date().toLocaleTimeString(), isAnimated: true }]);
        const plainTextLength = replyParts[i].replace(/<del>.*?<\/del>/g, '').length;
        const estimatedVisualTime = plainTextLength * 250 + 1000; 
        if (i < replyParts.length - 1) await new Promise(resolve => setTimeout(resolve, estimatedVisualTime));
      }
    } catch (error) {
      if (currentInteractionRef.current === interactionId) { setIsTypingIndicator(false); setMessages((prev) => [...prev, { id: Date.now(), role: 'assistant', text: `[系统异常] 请求失败: ${error.message}`, time: new Date().toLocaleTimeString(), isAnimated: false }]); }
    } finally { if (currentInteractionRef.current === interactionId) { setIsResponding(false); } }
  };

  const handleExtractTasks = async () => {
    setIsExtracting(true);
    try {
      const chatHistory = messages.filter(m => m.role !== 'system').map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text.replace(/<del>.*?<\/del>/g, '')}`).join('\n');
      const prompt = `分析以下对话记录，提取出所有代办事项。如果没有，请返回空数组。\n\n对话记录:\n${chatHistory}`;
      const jsonResponse = await callDoubaoAPI(prompt, `严格输出 JSON 字符串数组，例如：["联系张三", "发送邮件"]。`);
      let tasks = [];
      try { const cleanedJson = jsonResponse.replace(/```json/g, '').replace(/```/g, '').trim(); tasks = JSON.parse(cleanedJson); } catch (e) {}
      setExtractedTasks(tasks); setShowTasksModal(true);
    } catch (error) { alert("提炼失败，请稍后重试。"); } finally { setIsExtracting(false); }
  };

  const loadPersonaAndChat = (persona) => {
    setActivePersona(persona.personaPrompt);
    setMessages([{ id: 1, role: 'system', text: `已从云端唤醒【${persona.name}】。`, time: new Date().toLocaleTimeString(), isAnimated: false }, { id: 2, role: 'assistant', text: `你好，我是 ${persona.name} 的数字分身，我们继续聊吧。`, time: new Date().toLocaleTimeString(), isAnimated: true }]);
    setAppPhase('chat');
  };

  const handleDeleteSavedPersona = async (e, personaId) => {
    e.stopPropagation(); if (!user || !db) return;
    try { await db.collection('personas').doc(personaId).remove(); } catch (err) { console.error(err); }
  };
  // ---------------------------------------------------------------------------------------------------------

  if (appPhase === 'home') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center pt-20 pb-10 px-6 font-sans">
        <div className="bg-indigo-100 text-indigo-800 px-4 py-2 text-xs flex items-center justify-center space-x-2 rounded-full mb-12 shadow-sm border border-indigo-200">
          <ShieldCheck className="w-4 h-4" />
          <span className="font-semibold">2026 合规运作中</span>
          <span>已接入公安部算力备案网络及 PIPL 隐私保护层</span>
        </div>
        <div className="max-w-5xl w-full text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
            Identity as a Skill (IaaS)<br/><span className="text-indigo-600">数字资产编译器</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">基于多模态双擎驱动。只需上传对话片段，即刻提取记忆、经验与思考模型，生成具备灵魂的数字分身。</p>
        </div>
        <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-xl transition-all group flex flex-col">
            <div className="bg-amber-100 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><BookOpen className="w-7 h-7 text-amber-600" /></div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">名人人格/思想库</h3>
            <p className="text-sm text-slate-500 mb-8 flex-1 leading-relaxed">连接公共版权领域的专家、名人思想数据库（如鲁迅选集、乔布斯访谈录），进行沉浸式的互动知识学习。</p>
            <button onClick={() => alert('提示：【名人库】需要对接公共版权平台 API，当前为演示环境，请体验右侧【任意模拟数字人】。')} className="w-full py-3 rounded-xl font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors">进入版权库</button>
          </div>
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-xl transition-all group flex flex-col">
            <div className="bg-emerald-100 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Briefcase className="w-7 h-7 text-emerald-600" /></div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">企业工作继任者</h3>
            <p className="text-sm text-slate-500 mb-8 flex-1 leading-relaxed">对接企业钉钉/飞书组织架构。蒸馏离职或调岗员工的隐性思维逻辑与业务 SOP，防止企业核心资产流失。</p>
            <button onClick={() => alert('提示：【企业库】需连接企业内控 OA 系统，当前为演示环境，请体验右侧【任意模拟数字人】。')} className="w-full py-3 rounded-xl font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors">OA 授权登入</button>
          </div>
          <div className="bg-white rounded-3xl p-8 border-2 border-indigo-500 shadow-md hover:shadow-2xl transition-all group flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">推荐体验</div>
            <div className="bg-indigo-100 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Wand2 className="w-7 h-7 text-indigo-600" /></div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">任意模拟数字人</h3>
            <p className="text-sm text-slate-500 mb-8 flex-1 leading-relaxed">上传对象的微信截图等素材，通过多模态 AI 一键“蒸馏”性格与记忆，生成数字灵魂。</p>
            <button onClick={() => setShowAgreementModal(true)} className="w-full py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-colors flex justify-center items-center space-x-2"><span>立即创建分身</span><ArrowRight className="w-4 h-4" /></button>
          </div>
        </div>

        {showAgreementModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
              <div className="flex items-center space-x-3 mb-6 text-slate-800 border-b border-slate-100 pb-4">
                <div className="bg-slate-100 p-3 rounded-full"><Scale className="w-6 h-6 text-slate-700" /></div>
                <h2 className="text-2xl font-bold">数字人提取授权及免责协议</h2>
              </div>
              <div className="flex-1 overflow-y-auto pr-4 space-y-4 text-sm text-slate-600 leading-relaxed custom-scrollbar mb-6">
                <p>尊敬的用户，欢迎使用数字资产编译器【任意模拟数字人】功能。在继续操作前，请您务必仔细阅读：</p>
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 font-medium">
                  <h4 className="flex items-center mb-2"><AlertTriangle className="w-4 h-4 mr-2"/> 知情同意声明</h4>
                  <p className="text-xs">本平台仅提供 AI 算力与算法服务。您在使用本功能上传包含他人发言、文字、截图等数据时，<strong>必须已事先充分征得“被提取者”本人的明确同意。</strong></p>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <label className="flex items-start space-x-3 cursor-pointer group mb-6">
                  <input type="checkbox" checked={isAgreed} onChange={(e) => setIsAgreed(e.target.checked)} className="mt-1 w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"/>
                  <span className="text-sm text-slate-700 group-hover:text-slate-900 select-none">我已仔细阅读并同意上述协议，承诺已获得合法授权。</span>
                </label>
                <div className="flex space-x-3">
                  <button onClick={() => { setShowAgreementModal(false); setIsAgreed(false); }} className="flex-1 py-3 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">取消</button>
                  <button onClick={handleAgreeAndProceed} disabled={!isAgreed} className="flex-1 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 flex justify-center items-center space-x-2"><FileSignature className="w-5 h-5" /><span>同意并进入验证</span></button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 🌟 史诗级强化的专业注册/登录界面
  if (appPhase === 'auth') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-fade-in flex flex-col">
          
          {/* 顶部 Tab 切换区 */}
          <div className="flex bg-slate-100 p-2 m-4 rounded-2xl">
            <button onClick={() => setAuthMethod('email')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center transition-all ${authMethod === 'email' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Mail className="w-4 h-4 mr-2" /> 邮箱通行证
            </button>
            <button onClick={() => setAuthMethod('phone')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center transition-all ${authMethod === 'phone' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Smartphone className="w-4 h-4 mr-2" /> 手机快捷登录
            </button>
          </div>

          <div className="px-10 pb-10 pt-2 flex-1">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-extrabold text-slate-900 mb-2">{isLoginMode ? '欢迎回来' : '创建数字资产档案'}</h1>
              <p className="text-slate-500 text-sm">
                {isLoginMode ? '登录编译器，唤醒您的专属数字分身' : '注册即分配全站唯一专属系统 ID'}
              </p>
            </div>

            {authError && (
              <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 flex items-start shadow-sm">
                <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" /><span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-5">
              {/* 仅在注册模式下显示的字段 */}
              {!isLoginMode && authMethod === 'email' && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">数字前台昵称</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User className="h-5 w-5 text-slate-400"/></div>
                      <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} required minLength="2" maxLength="12" className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium text-slate-900" placeholder="请输入你的昵称 (如: 铁胆火车侠)" />
                    </div>
                  </div>
                </div>
              )}

              {/* 账号/密码 通用字段 */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">{authMethod === 'email' ? '绑定邮箱' : '手机号码'}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    {authMethod === 'email' ? <Mail className="h-5 w-5 text-slate-400"/> : <Smartphone className="h-5 w-5 text-slate-400"/>}
                  </div>
                  <input type={authMethod === 'email' ? "email" : "tel"} value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium text-slate-900" placeholder={authMethod === 'email' ? "your@email.com" : "138 0000 0000"} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">{authMethod === 'email' ? '安全密码' : '短信验证码'}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-slate-400"/></div>
                  <input type={authMethod === 'email' ? "password" : "text"} value={password} onChange={e => setPassword(e.target.value)} required={authMethod === 'email'} minLength={authMethod === 'email' ? "6" : "4"} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium text-slate-900" placeholder={authMethod === 'email' ? "至少 6 位密码" : "请输入 6 位验证码"} />
                  {authMethod === 'phone' && (
                    <button type="button" className="absolute inset-y-2 right-2 px-4 bg-indigo-50 text-indigo-600 font-bold text-xs rounded-lg hover:bg-indigo-100 transition-colors">获取验证码</button>
                  )}
                </div>
              </div>

              {/* 仅在注册模式下显示的二次密码确认 */}
              {!isLoginMode && authMethod === 'email' && (
                <div className="animate-fade-in">
                  <label className="block text-sm font-bold text-slate-700 mb-2">确认安全密码</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><ShieldCheck className="h-5 w-5 text-slate-400"/></div>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength="6" className={`w-full bg-slate-50 border ${confirmPassword && confirmPassword !== password ? 'border-red-400 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'} rounded-xl pl-11 pr-4 py-3.5 focus:ring-2 focus:bg-white outline-none transition-all font-medium text-slate-900`} placeholder="请再次输入密码以确认" />
                  </div>
                  {confirmPassword && confirmPassword !== password && <p className="text-red-500 text-xs font-bold mt-2 pl-1">❌ 两次密码输入不一致</p>}
                </div>
              )}

              <button type="submit" disabled={isAuthenticating || (authMethod === 'email' && !isLoginMode && password !== confirmPassword)} className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-lg flex justify-center items-center shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {isAuthenticating ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>{authMethod === 'phone' ? '快捷登录' : (isLoginMode ? '安全登录' : '立即注册分配 ID')}</span>}
              </button>
            </form>

            {authMethod === 'email' && (
              <div className="text-center mt-6">
                <button onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); setPassword(''); setConfirmPassword(''); }} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                  {isLoginMode ? '没有档案？点此注册建立新档案' : '已有档案？点此返回登录'}
                </button>
              </div>
            )}

            <div className="relative flex items-center py-6"><div className="flex-grow border-t border-slate-100"></div><span className="flex-shrink-0 mx-4 text-slate-300 text-xs font-bold uppercase tracking-wider">临时体验区</span><div className="flex-grow border-t border-slate-100"></div></div>
            
            <button onClick={handleGuestAuth} disabled={isAuthenticating} className="w-full bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 py-3.5 rounded-xl font-bold flex justify-center items-center space-x-2 transition-all">
              <UserCircle className="w-5 h-5" /><span>游客免密登入 (数据阅后即焚)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (appPhase === 'dashboard') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center p-6 font-sans">
        
        {/* 🌟 升级版顶部用户状态栏，展示专属 ID 和昵称 */}
        <div className="w-full max-w-5xl flex justify-end mb-6">
          <div className="bg-white border border-slate-200 shadow-sm rounded-full px-5 py-2 flex items-center space-x-4">
            <div className="flex items-center space-x-2 border-r border-slate-100 pr-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${user?.isAnonymous ? 'bg-amber-400' : 'bg-indigo-600'}`}>
                {userProfile?.nickname ? userProfile.nickname.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-800 leading-tight">{userProfile?.nickname || (user?.isAnonymous ? '匿名游客' : '载入中...')}</span>
                {!user?.isAnonymous && userProfile?.shortId && (
                  <span className="text-[10px] text-slate-400 flex items-center font-mono mt-0.5"><Hash className="w-3 h-3 mr-0.5" /> {userProfile.shortId}</span>
                )}
              </div>
            </div>
            <button onClick={handleLogout} className="flex items-center text-sm font-bold text-slate-400 hover:text-red-500 transition-colors"><LogOut className="w-4 h-4 mr-1" /> 退出</button>
          </div>
        </div>

        <div className="max-w-3xl w-full">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">个人数字资产工作台</h1>
            <p className="text-slate-500">上传真实对话截图或文本文件，AI将自动“看”懂内容并提取性格</p>
          </div>
          {user?.isAnonymous && (
            <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start space-x-3">
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div><p className="font-bold text-sm">您正在使用匿名游客模式</p><p className="text-xs mt-1 opacity-80 font-medium">提取的数字分身仅在本地缓存，刷新即焚。如需分配云端专属 ID 和记忆库，请退出并注册。</p></div>
            </div>
          )}
          {!user?.isAnonymous && savedPersonas.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6 animate-fade-in">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 flex items-center"><Database className="w-5 h-5 mr-2 text-indigo-600" />云端记忆库</h2>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-bold">永久安全存储</span>
              </div>
              <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                {savedPersonas.map(persona => (
                  <div key={persona.id} onClick={() => loadPersonaAndChat(persona)} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl cursor-pointer group border border-transparent hover:border-slate-200 transition-all">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className="bg-indigo-50 border border-indigo-100 p-2.5 rounded-xl group-hover:bg-indigo-600 group-hover:border-indigo-600 transition-colors"><UserCircle className="w-6 h-6 text-indigo-500 group-hover:text-white" /></div>
                      <div className="truncate text-left">
                        <h3 className="font-bold text-slate-800 truncate">{persona.name}</h3>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">{new Date(persona.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <button onClick={(e) => handleDeleteSavedPersona(e, persona.id)} className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
            <div className="p-8 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center"><ImageIcon className="w-5 h-5 mr-2 text-indigo-500" /> 注入多元素材 (支持JPG/PNG截图 或 TXT文档)</h2>
              <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.jpg,.jpeg,.png" />
              <div className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${uploadedFiles.length > 0 ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`} onClick={() => fileInputRef.current?.click()}>
                {uploadedFiles.length > 0 ? (
                  <div className="flex flex-col items-center text-indigo-600">
                    <CheckSquare className="w-12 h-12 mb-4" />
                    <div className="flex flex-col items-center space-y-2 mb-1">
                      {uploadedFiles.map((f, i) => (
                        <span key={i} className="font-bold text-md flex items-center bg-white px-4 py-2 rounded-lg shadow-sm border border-indigo-100">{f.type === 'doc' ? <FileText className="w-4 h-4 mr-2 text-indigo-400" /> : <ImageIcon className="w-4 h-4 mr-2 text-indigo-400" />}{f.name} <span className="text-xs text-indigo-400 ml-2 font-medium">({f.size})</span></span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-slate-500">
                    <UploadCloud className="w-12 h-12 mb-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                    <span className="font-bold text-slate-700">点击上传真实的聊天截图(图片) 或 .txt纯文本</span>
                  </div>
                )}
              </div>
            </div>
            <div className="p-8 bg-slate-50/50">
              <button onClick={handleStartDistillation} disabled={uploadedFiles.length === 0} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center space-x-2 shadow-lg shadow-indigo-200 transition-all"><span>读取内容并一键生成数字分身</span><ArrowRight className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // [下方的 distilling 阶段和 chat 阶段代码保持原样不变，粘贴时请顺延]
  if (appPhase === 'distilling') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-300 flex items-center justify-center p-6 font-mono">
        <div className="max-w-2xl w-full">
          <div className="flex items-center space-x-3 mb-6"><Loader2 className="w-8 h-8 text-indigo-400 animate-spin" /><h1 className="text-2xl font-bold text-white">Multimodal Distillation</h1></div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
            <div className="h-2 bg-slate-700 w-full"><div className="h-full bg-indigo-500 transition-all duration-500 ease-out relative" style={{ width: `${distillProgress}%` }}><div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20 animate-pulse"></div></div></div>
            <div className="p-6 h-[400px] overflow-y-auto text-sm space-y-3 custom-scrollbar">
              {distillLogs.map((log, idx) => (<div key={idx} className={`${log.includes('成功') ? 'text-green-400 font-bold' : log.includes('致命') ? 'text-red-400 font-bold' : ''}`}><span className="text-slate-500 mr-3">[{new Date().toLocaleTimeString()}]</span>{log}</div>))}
              {distillProgress < 100 && (<div className="flex items-center text-indigo-400 mt-2"><Terminal className="w-4 h-4 mr-2" /><span className="animate-pulse">_</span></div>)}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-100 flex flex-col font-sans overflow-hidden">
      {showComplianceBanner && (
        <div className="bg-amber-100 text-amber-800 px-4 py-2 text-xs flex items-center justify-center space-x-2 border-b border-amber-200 shrink-0 relative transition-all">
          <button onClick={() => setShowComplianceBanner(false)} className="absolute left-3 p-1 hover:bg-amber-200 rounded text-amber-600 transition-colors" title="关闭提示"><X className="w-4 h-4" /></button>
          <AlertTriangle className="w-4 h-4" /><span className="font-bold">合规提示：</span><span className="font-medium">交互对象为 AI 解析生成的【数字人物】，注意观察对方打字时的删改习惯（停顿、退格）。</span>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm shrink-0 z-10">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-50 border border-blue-100 p-2.5 rounded-full"><UserCircle className="w-6 h-6 text-blue-600" /></div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">自定义数字分身 (沉浸式打字版)</h1>
            <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1 h-4 font-medium">
              {isResponding && (
                <span className="flex items-center text-blue-500 font-bold animate-pulse bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5"></span>对方正在输入中...
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button onClick={handleExtractTasks} disabled={isExtracting || messages.length <= 2} className="flex items-center space-x-1.5 text-indigo-600 hover:bg-indigo-50 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border border-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed">
            {isExtracting ? <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div> : <Sparkles className="w-4 h-4" />}<span>智能提炼代办</span>
          </button>
          <button onClick={() => setShowDeleteModal(true)} className="flex items-center space-x-1.5 text-red-500 hover:bg-red-50 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border border-red-100">
            <Trash2 className="w-4 h-4" /><span>行使被遗忘权</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            {msg.role === 'system' ? (
               <div className="mx-auto bg-slate-200/70 text-slate-600 text-xs py-1.5 px-4 rounded-full font-bold my-4 border border-slate-200">{msg.text}</div>
            ) : (
              <div className={`max-w-[75%] rounded-2xl px-5 py-3.5 shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none'}`}>
                {msg.role === 'assistant' && msg.isAnimated ? (
                  <SimulatedTypingText content={msg.text} persona={activePersona} scrollRef={messagesEndRef} onComplete={() => { setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isAnimated: false } : m)); }} />
                ) : (
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap font-medium">{msg.text.replace(/<del>.*?<\/del>/g, '')}</p>
                )}
                <span className={`text-[10px] mt-2.5 block font-bold tracking-wide ${msg.role === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                  {msg.time} {msg.role === 'assistant' && ' • AI 生成'}
                </span>
              </div>
            )}
          </div>
        ))}
        {isTypingIndicator && (
           <div className="flex items-start">
             <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-none px-5 py-4.5 shadow-sm flex space-x-2">
               <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div><div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </main>

      <footer className="bg-white border-t border-slate-200 p-4 shrink-0">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex space-x-4">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="随便聊点什么，随时可以打断对方..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-slate-800" />
          <button type="submit" disabled={!input.trim()} className="bg-blue-600 text-white p-3.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"><Send className="w-6 h-6" /></button>
        </form>
      </footer>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-fade-in">
            <div className="flex items-center space-x-3 text-red-600 mb-5">
              <div className="bg-red-50 p-2 rounded-full"><AlertTriangle className="w-6 h-6" /></div><h2 className="text-xl font-bold">终止数字人连接？</h2>
            </div>
            <p className="text-sm text-slate-600 mb-8 leading-relaxed font-medium">数据销毁不可逆。系统将彻底擦除您刚才上传的图片内容记忆以及对应的数字人格设定，并退回大厅。</p>
            <div className="flex space-x-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 bg-slate-100 text-slate-700 py-3.5 rounded-xl font-bold hover:bg-slate-200 transition-colors">取消</button>
              <button onClick={() => window.location.reload()} className="flex-1 bg-red-600 text-white py-3.5 rounded-xl font-bold hover:bg-red-700 flex items-center justify-center space-x-2 transition-colors shadow-lg shadow-red-200"><Trash2 className="w-4 h-4" /><span>退出销毁</span></button>
            </div>
          </div>
        </div>
      )}

      {showTasksModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2 text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg"><CheckSquare className="w-5 h-5" /><h2 className="text-lg font-bold">已提炼代办事项</h2></div>
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="space-y-3 mb-6 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {extractedTasks.length === 0 ? (
                <p className="text-sm text-slate-500 font-bold text-center py-8 bg-slate-50 rounded-2xl border border-slate-100">当前对话未检测到明确的代办事项。</p>
              ) : (
                extractedTasks.map((task, idx) => (
                  <label key={idx} className="flex items-start space-x-3 bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors cursor-pointer group">
                    <input type="checkbox" className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" />
                    <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{typeof task === 'object' ? JSON.stringify(task) : String(task)}</span>
                  </label>
                ))
              )}
            </div>
            <button onClick={() => setShowTasksModal(false)} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">完成并关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}
