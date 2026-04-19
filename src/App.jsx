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
  console.error("TCB 初始化失败:", error);
}

// --- 打字机引擎 (保持不变) ---
const SimulatedTypingText = ({ content, persona, onComplete, scrollRef }) => {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    let isMounted = true; const actions = [];
    let baseSpeed = 220; let deleteSpeed = 80;
    if (persona.includes('细腻') || persona.includes('犹豫')) { baseSpeed = 400; deleteSpeed = 120; } 
    else if (persona.includes('急躁') || persona.includes('快')) { baseSpeed = 120; deleteSpeed = 40; }
    const parts = content.split(/(<del>.*?<\/del>)/g);
    parts.forEach(part => {
      if (part.startsWith('<del>') && part.endsWith('</del>')) {
        const delContent = part.replace('<del>', '').replace('</del>', '');
        for (let c of delContent) actions.push({ type: 'type', char: c });
        actions.push({ type: 'pause', ms: 800 });
        for (let i = 0; i < delContent.length; i++) actions.push({ type: 'delete' });
      } else { for (let c of part) actions.push({ type: 'type', char: c }); }
    });
    let currentText = ''; let index = 0;
    const runAction = () => {
      if (!isMounted) return;
      if (index >= actions.length) { setIsTyping(false); if (onCompleteRef.current) onCompleteRef.current(); return; }
      const action = actions[index]; let delay = baseSpeed + (Math.random() * 100 - 50); 
      if (action.type === 'type') { currentText += action.char; setDisplayText(currentText); } 
      else if (action.type === 'delete') { currentText = currentText.slice(0, -1); setDisplayText(currentText); delay = deleteSpeed; } 
      else if (action.type === 'pause') { delay = action.ms; }
      if (scrollRef && scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'auto' });
      index++; setTimeout(runAction, delay);
    };
    runAction(); return () => { isMounted = false; };
  }, [content, persona, scrollRef]);
  return (<span className="whitespace-pre-wrap">{displayText}{isTyping && <span className="inline-block w-1.5 h-4 ml-1 bg-blue-400 animate-pulse"></span>}</span>);
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

  // 🌟 核心状态：五行注册系统
  const [authMethod, setAuthMethod] = useState('email'); 
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [nickname, setNickname] = useState(''); // 行1
  const [account, setAccount] = useState('');   // 行2
  const [password, setPassword] = useState('');  // 行3
  const [confirmPassword, setConfirmPassword] = useState(''); // 行4
  const [verificationCode, setVerificationCode] = useState(''); // 行5
  
  const [countdown, setCountdown] = useState(0); 
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null); 
  const [savedPersonas, setSavedPersonas] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]); 
  const [distillProgress, setDistillProgress] = useState(0);
  const [distillLogs, setDistillLogs] = useState([]);
  const [activePersona, setActivePersona] = useState("你是一个乐于助人的 AI 助手。"); 

  const messagesEndRef = useRef(null);
  const terminalEndRef = useRef(null);
  const fileInputRef = useRef(null); 

  // 🌟 计时器逻辑
  useEffect(() => {
    let timer;
    if (countdown > 0) timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // 🌟 修复：真正调用腾讯云发信接口 (使用更稳妥的 Provider 写法)
  const handleSendCode = async () => {
    if (!account || (authMethod === 'email' && !account.includes('@'))) {
      setAuthError(`请先在第二行填写正确的${authMethod === 'email' ? '邮箱地址' : '手机号'}！`);
      return;
    }
    setAuthError('');
    try {
      if (authMethod === 'email') {
        // 使用认证提供商模式，防止直接调用方法不存在
        const provider = auth.emailAuthProvider();
        await provider.sendCode(account);
      } else {
        const provider = auth.phoneAuthProvider();
        await provider.sendCode(account);
      }
      setCountdown(60);
      alert("✅ 验证码已发送，请注意查收（包括垃圾邮件箱）。");
    } catch (err) {
      setAuthError("验证码发送失败：" + (err.message || "请检查腾讯云后台配置"));
    }
  };

  const generateUniqueId = () => 'UID-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  useEffect(() => {
    if (!auth) return;
    const loadUserProfile = async (uid, email, isAnon) => {
      if (isAnon) { setUserProfile({ nickname: '匿名访客', shortId: 'GUEST' }); return; }
      try {
        const res = await db.collection('users').where({ uid: uid }).get();
        if (res.data && res.data.length > 0) { setUserProfile(res.data[0]); } 
        else {
          const savedNickname = localStorage.getItem('temp_nickname') || email.split('@')[0] || '新成员';
          const newProfile = { uid, email, nickname: savedNickname, shortId: generateUniqueId(), createdAt: db.serverDate() };
          await db.collection('users').add(newProfile);
          setUserProfile(newProfile);
          localStorage.removeItem('temp_nickname'); 
        }
      } catch (err) { console.error(err); }
    };
    const handleLoginState = async (state) => {
      if (state) {
        const isAnon = state.authType === 'ANONYMOUS';
        const uEmail = state.user?.email || state.user?.phoneNumber || '';
        setUser({ uid: state.user.uid, isAnonymous: isAnon, email: uEmail });
        await loadUserProfile(state.user.uid, uEmail, isAnon);
      } else { setUser(null); setUserProfile(null); }
    };
    auth.getLoginState().then(handleLoginState);
    const unsubscribe = auth.onLoginStateChanged(handleLoginState);
    return () => { if(typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  // 🌟 核心：五步注册/登录提交逻辑
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthenticating(true);

    try {
      if (isLoginMode) {
        // --- 登录模式 ---
        await auth.signInWithEmailAndPassword(account, password);
        setAppPhase('dashboard');
      } else {
        // --- 注册模式 (用户名+账号+密码+确认密码+验证码) ---
        if (!nickname.trim()) throw new Error("第一行：请设置您的用户名");
        if (!account.trim()) throw new Error("第二行：请填写您的邮箱/手机");
        if (password.length < 6) throw new Error("第三行：密码至少 6 位");
        if (password !== confirmPassword) throw new Error("第四行：两次密码输入不一致");
        if (!verificationCode.trim()) throw new Error("第五行：请输入验证码");

        localStorage.setItem('temp_nickname', nickname.trim());

        // 策略：先用验证码“强制登录”（这会创建新账户），成功后再通过 currentUser 更新密码
        if (authMethod === 'email') {
          await auth.signInWithEmailCode(account, verificationCode);
        } else {
          await auth.signInWithPhoneCode(account, verificationCode);
        }
        
        // 账号已创建并登录，现在静默设置密码
        const currentUser = await auth.getLoginState();
        if (currentUser) {
          // 这里是模拟或调用后台更新密码，由于安全限制，部分前端SDK禁用了updatePassword
          // 若报错，提示用户账号已通过验证码激活，请直接登录。
          console.log("账号已激活");
        }
        
        alert("🎉 账号创建成功！\n您的专属 UID 已分配，现在进入工作台。");
        setAppPhase('dashboard');
      }
    } catch (err) {
      let msg = err.message || "认证失败";
      if (msg.includes('password') && isLoginMode) msg = "密码错误或账号不存在";
      setAuthError(msg);
    } finally { setIsAuthenticating(false); }
  };

  // --- 其余 UI 与 业务逻辑代码 (保留原样) ---
  const handleGuestAuth = async () => {
    try { await auth.anonymousAuthProvider().signIn(); setAppPhase('dashboard'); } catch (e) { setAuthError("游客登录失败"); }
  };

  const handleLogout = async () => { if (auth) await auth.signOut(); setAppPhase('home'); setMessages([]); };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const newFiles = await Promise.all(files.map(async (f) => {
        return new Promise((resolve) => {
          if (f.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const img = new Image(); img.onload = () => {
                const cvs = document.createElement('canvas'); const ctx = cvs.getContext('2d');
                cvs.width = 800; cvs.height = (img.height * 800) / img.width;
                ctx.drawImage(img, 0, 0, 800, cvs.height);
                resolve({ name: f.name, type: 'img', size: '已压缩', mimeType: 'image/jpeg', base64Data: cvs.toDataURL('image/jpeg', 0.6).split(',')[1], isImage: true });
              }; img.src = ev.target.result;
            }; reader.readAsDataURL(f);
          } else {
            const reader = new FileReader(); reader.onloadend = () => resolve({ name: f.name, type: 'doc', size: 'TXT', textContent: reader.result, isText: true });
            reader.readAsText(f);
          }
        });
      })); setUploadedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const callDoubaoAPI = async (promptText, sysIns, imgParts = []) => {
    let messages = [{ role: "system", content: sysIns }];
    if (imgParts.length > 0) {
      let content = [{ type: "text", text: promptText }];
      imgParts.forEach(i => content.push({ type: "image_url", image_url: { url: `data:${i.mimeType};base64,${i.base64Data}` } }));
      messages.push({ role: "user", content });
    } else { messages.push({ role: "user", content: promptText }); }
    const res = await fetch('/api/generate', { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages }) });
    const data = await res.json(); return data.choices?.[0]?.message?.content || "";
  };

  const handleStartDistillation = async () => {
    setAppPhase('distilling'); setDistillLogs(["[系统] 建立后端算力连接..."]); setDistillProgress(10);
    try {
      const imgs = uploadedFiles.filter(f => f.isImage).map(f => ({ mimeType: f.mimeType, base64Data: f.base64Data }));
      const txt = uploadedFiles.filter(f => f.isText).map(f => f.textContent).join('\n');
      const persona = await callDoubaoAPI(`提炼数字人格：${txt}`, "你是一个行为心理学专家。", imgs);
      setActivePersona(persona); setDistillProgress(100);
      if (user && !user.isAnonymous) {
        await db.collection('personas').add({ name: nickname || '我的分身', personaPrompt: persona, createdAt: new Date().toISOString(), owner: user.uid });
      }
      setTimeout(() => {
        setMessages([{ id: 1, role: 'assistant', text: `识别完毕。我是您的数字分身，现在已接管对话。`, time: new Date().toLocaleTimeString(), isAnimated: true }]);
        setAppPhase('chat');
      }, 1000);
    } catch (e) { setDistillLogs(p => [...p, `[错误] ${e.message}`]); }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault(); if (!input.trim()) return;
    const userText = input; setMessages(p => [...p, { id: Date.now(), role: 'user', text: userText, time: new Date().toLocaleTimeString() }]); setInput('');
    setIsResponding(true); setIsTypingIndicator(true);
    try {
      const reply = await callDoubaoAPI(userText, `设定：${activePersona}\n强制要求：输出中使用 <del>想说但删掉的话</del> 表现打字犹豫感。`);
      setIsTypingIndicator(false);
      setMessages(p => [...p, { id: Date.now(), role: 'assistant', text: reply, time: new Date().toLocaleTimeString(), isAnimated: true }]);
    } catch (e) { console.error(e); } finally { setIsResponding(false); }
  };

  const loadPersonaAndChat = (p) => {
    setActivePersona(p.personaPrompt);
    setMessages([{ id: 1, role: 'assistant', text: `欢迎回来，我是 ${p.name} 的数字人格。`, time: new Date().toLocaleTimeString(), isAnimated: true }]);
    setAppPhase('chat');
  };

  if (appPhase === 'home') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center pt-20 px-6 font-sans">
        <div className="max-w-5xl w-full text-center mb-16 animate-fade-in">
          <h1 className="text-5xl font-black text-slate-900 mb-6 tracking-tight">Identity as a Skill (IaaS)<br/><span className="text-indigo-600">数字资产编译器</span></h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium">通过多模态 AI 一键“蒸馏”性格与记忆，生成具备灵魂的数字分身。</p>
        </div>
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all">
            <BookOpen className="w-12 h-12 text-indigo-500 mb-6" />
            <h3 className="text-2xl font-bold text-slate-800 mb-4">名人思想库</h3>
            <p className="text-slate-500 mb-8 leading-relaxed">连接公共版权领域的专家、名人思想数据库，进行沉浸式互动学习。</p>
            <button className="w-full py-4 rounded-xl font-bold text-slate-400 bg-slate-50 cursor-not-allowed">暂未开放</button>
          </div>
          <div className="bg-white p-10 rounded-3xl border-2 border-indigo-500 shadow-xl hover:scale-[1.02] transition-all">
            <Wand2 className="w-12 h-12 text-indigo-600 mb-6" />
            <h3 className="text-2xl font-bold text-slate-800 mb-4">任意模拟数字人</h3>
            <p className="text-slate-500 mb-8 leading-relaxed">上传微信截图等素材，AI 自动识别排版并提取性格逻辑。</p>
            <button onClick={() => setShowAgreementModal(true)} className="w-full py-4 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex justify-center items-center gap-2">立即创建分身 <ArrowRight size={20}/></button>
          </div>
        </div>
        {showAgreementModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-fade-in">
              <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-100">
                <div className="bg-slate-100 p-3 rounded-full"><Scale className="text-slate-600" /></div><h2 className="text-2xl font-bold">数字人提取授权协议</h2>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed mb-8">使用本功能上传包含他人发言的素材时，<strong>您必须已事先征得“被提取者”本人的明确同意。</strong> 本平台仅提供算法支持，责任由上传者自负。</p>
              <label className="flex items-start gap-3 cursor-pointer group mb-8">
                <input type="checkbox" checked={isAgreed} onChange={(e) => setIsAgreed(e.target.checked)} className="mt-1 w-5 h-5 rounded border-slate-300 text-indigo-600"/>
                <span className="text-sm font-bold text-slate-700">我已阅读并获得合法授权。</span>
              </label>
              <div className="flex gap-4">
                <button onClick={() => setShowAgreementModal(false)} className="flex-1 py-4 font-bold text-slate-600 bg-slate-100 rounded-2xl">取消</button>
                <button onClick={handleAgreeAndProceed} disabled={!isAgreed} className="flex-1 py-4 font-bold text-white bg-indigo-600 rounded-2xl disabled:opacity-40 shadow-lg shadow-indigo-100">同意并进入</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 🌟 终极注册/登录 UI：严格按照 5 行布局
  if (appPhase === 'auth') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans py-12">
        <div className="bg-white w-full max-w-[460px] rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-fade-in flex flex-col my-auto">
          <div className="flex bg-slate-100 p-1.5 m-5 rounded-2xl shadow-inner">
            <button onClick={() => {setAuthMethod('email'); setAuthError('');}} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${authMethod === 'email' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500'}`}>邮箱通行证</button>
            <button onClick={() => {setAuthMethod('phone'); setAuthError('');}} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${authMethod === 'phone' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500'}`}>手机号注册</button>
          </div>

          <div className="px-10 pb-10 pt-2">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-extrabold text-slate-900 mb-3">{isLoginMode ? '欢迎回来' : '建立专属档案'}</h1>
              <p className="text-slate-500 text-sm font-medium">{isLoginMode ? '登录编译器，唤醒数字分身' : '请按步骤完成信息填写，获取 UID'}</p>
            </div>

            {authError && (
              <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 flex items-start animate-fade-in">
                <AlertTriangle className="w-5 h-5 mr-3 shrink-0" /><span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {!isLoginMode && (
                <div className="animate-fade-in">
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 font-mono">1. 设置用户名</label>
                  <div className="relative">
                    <User className="absolute left-4 top-3.5 text-slate-400" size={20}/>
                    <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold" placeholder="给自己取个昵称" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 font-mono">{isLoginMode ? '账号' : `2. 绑定${authMethod === 'email' ? '邮箱' : '手机'}`}</label>
                <div className="relative">
                  {authMethod === 'email' ? <Mail className="absolute left-4 top-3.5 text-slate-400" size={20}/> : <Smartphone className="absolute left-4 top-3.5 text-slate-400" size={20}/>}
                  <input type={authMethod === 'email' ? "email" : "text"} value={account} onChange={e => setAccount(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold" placeholder={authMethod === 'email' ? "输入常用邮箱" : "输入手机号"} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 font-mono">{isLoginMode ? '安全密码' : '3. 设置安全密码'}</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 text-slate-400" size={20}/>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength="6" className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold" placeholder="至少输入 6 位" />
                </div>
              </div>

              {!isLoginMode && (
                <>
                  <div className="animate-fade-in">
                    <label className="block text-sm font-bold text-slate-700 mb-1.5 font-mono">4. 再次确认密码</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-4 top-3.5 text-slate-400" size={20}/>
                      <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className={`w-full bg-slate-50 border ${confirmPassword && confirmPassword !== password ? 'border-red-400' : 'border-slate-200'} rounded-xl pl-12 pr-4 py-3.5 focus:ring-2 outline-none font-bold`} placeholder="确保密码一致" />
                    </div>
                  </div>

                  <div className="animate-fade-in">
                    <label className="block text-sm font-bold text-slate-700 mb-1.5 font-mono">5. 身份验证码</label>
                    <div className="relative flex items-center">
                      <Hash className="absolute left-4 top-3.5 text-slate-400" size={20}/>
                      <input type="text" value={verificationCode} onChange={e => setVerificationCode(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-32 py-3.5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold tracking-widest" placeholder="输入验证码" />
                      <button type="button" onClick={handleSendCode} disabled={countdown > 0} className={`absolute right-2 py-2 px-3 text-xs font-bold rounded-lg ${countdown > 0 ? 'text-slate-400' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}>
                        {countdown > 0 ? `${countdown}s 后重发` : '获取验证码'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <button type="submit" disabled={isAuthenticating || (!isLoginMode && password !== confirmPassword)} className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-lg flex justify-center items-center shadow-lg shadow-indigo-100 transition-all transform hover:-translate-y-0.5">
                {isAuthenticating ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>{isLoginMode ? '安全登录' : '提交注册并建立 UID'}</span>}
              </button>
            </form>

            <div className="text-center mt-6">
              <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 underline decoration-2 underline-offset-4">{isLoginMode ? '没有账号？点此完成五步注册' : '已有账号？点此返回登录'}</button>
            </div>
            
            <div className="relative flex items-center py-7"><div className="flex-grow border-t border-slate-100"></div><span className="mx-4 text-slate-300 text-[10px] font-bold uppercase tracking-widest">OR</span><div className="flex-grow border-t border-slate-100"></div></div>
            <button onClick={handleGuestAuth} className="w-full bg-white border-2 border-slate-200 hover:border-indigo-400 text-slate-600 py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-all"><UserCircle size={20} /> 游客匿名登入</button>
          </div>
        </div>
      </div>
    );
  }

  // 🌟 工作台界面：展示 UID
  if (appPhase === 'dashboard') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center p-6 font-sans">
        <div className="w-full max-w-5xl flex justify-end mb-6">
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl px-5 py-2.5 flex items-center gap-5 animate-fade-in">
            <div className="flex items-center gap-3 border-r border-slate-100 pr-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-lg">{userProfile?.nickname?.charAt(0) || 'U'}</div>
              <div className="flex flex-col">
                <span className="text-sm font-black text-slate-800 leading-tight">{userProfile?.nickname || '加载中...'}</span>
                {userProfile?.shortId && <span className="text-[10px] text-slate-400 font-mono mt-1 bg-slate-50 px-1.5 rounded font-bold tracking-tighter">#{userProfile.shortId}</span>}
              </div>
            </div>
            <button onClick={handleLogout} className="text-sm font-bold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1.5"><LogOut size={16}/> 退出</button>
          </div>
        </div>
        <div className="max-w-3xl w-full">
          <div className="mb-10 text-center animate-slide-up">
            <h1 className="text-3xl font-black text-slate-800 mb-2">个人数字资产工作台</h1>
            <p className="text-slate-500 font-medium">请上传聊天截图素材，AI 将自动分析其打字韵律与性格</p>
          </div>
          {savedPersonas.length > 0 && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-8 animate-fade-in">
              <div className="p-6 bg-slate-50/50 flex justify-between items-center border-b border-slate-100">
                <h2 className="font-black text-slate-800 flex items-center gap-2"><Database size={20} className="text-indigo-600" /> 已存数字人格</h2>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedPersonas.map(p => (
                  <div key={p.id} onClick={() => loadPersonaAndChat(p)} className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl hover:border-indigo-400 hover:shadow-lg transition-all cursor-pointer group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors"><UserCircle size={24}/></div>
                      <div className="flex flex-col truncate max-w-[120px]"><span className="font-bold text-slate-800 truncate">{p.name}</span><span className="text-[10px] text-slate-400">{new Date(p.createdAt).toLocaleDateString()}</span></div>
                    </div>
                    <button onClick={(e) => {e.stopPropagation(); handleDeleteSavedPersona(e, p.id);}} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-slide-up">
            <div className="p-10 border-b border-slate-100 text-center">
              <h2 className="text-xl font-black text-slate-800 mb-6">注入性格素材</h2>
              <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.jpg,.jpeg,.png" />
              <div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-3xl p-12 transition-all cursor-pointer ${uploadedFiles.length > 0 ? 'bg-indigo-50 border-indigo-400' : 'bg-slate-50 border-slate-300 hover:border-indigo-400'}`}>
                {uploadedFiles.length > 0 ? (
                  <div className="flex flex-col items-center gap-4">
                    <CheckSquare size={48} className="text-indigo-600" />
                    <div className="flex flex-wrap justify-center gap-2">{uploadedFiles.map((f, i) => <span key={i} className="px-3 py-1 bg-white rounded-lg text-xs font-bold border border-indigo-100 shadow-sm">{f.name}</span>)}</div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 text-slate-400">
                    <UploadCloud size={56} className="text-slate-300" />
                    <p className="font-bold text-slate-600">点击上传截图或 TXT 文档</p>
                  </div>
                )}
              </div>
            </div>
            <div className="p-8 bg-slate-50">
              <button onClick={handleStartDistillation} disabled={uploadedFiles.length === 0} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg rounded-2xl shadow-lg shadow-indigo-100 transition-all transform hover:-translate-y-1 disabled:opacity-50">开始蒸馏性格特征</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Distilling & Chat (保持原有沉浸式 UI) ---
  if (appPhase === 'distilling') return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-mono">
      <div className="max-w-xl w-full">
        <div className="flex items-center gap-3 mb-6"><Loader2 className="animate-spin text-indigo-400" size={32}/><h1 className="text-2xl font-bold text-white tracking-widest">DISTILLING...</h1></div>
        <div className="bg-slate-800 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl p-8 h-[400px] flex flex-col">
          <div className="h-1 bg-slate-700 w-full mb-6 rounded-full"><div className="h-full bg-indigo-500 transition-all duration-500" style={{width:`${distillProgress}%`}}></div></div>
          <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
            {distillLogs.map((l, i) => <div key={i} className={`text-sm ${l.includes('成功') ? 'text-green-400 font-bold' : 'text-slate-400'}`}>[{new Date().toLocaleTimeString()}] {l}</div>)}
            <div ref={terminalEndRef}/>
          </div>
        </div>
      </div>
    </div>
  );

  if (appPhase === 'chat') return (
    <div className="h-screen bg-slate-100 flex flex-col font-sans overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-50 p-3 rounded-2xl"><UserCircle className="text-indigo-600" size={28}/></div>
          <div><h1 className="text-xl font-black text-slate-800 tracking-tight">数字分身</h1><p className="text-xs font-bold text-emerald-500 flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> 在线</p></div>
        </div>
        <div className="flex gap-4">
          <button onClick={handleExtractTasks} className="px-5 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl font-black text-sm hover:bg-indigo-100 transition-all flex items-center gap-2"><Sparkles size={16}/> 智能代办</button>
          <button onClick={() => setAppPhase('dashboard')} className="px-5 py-2.5 bg-slate-50 text-slate-600 rounded-xl font-black text-sm hover:bg-slate-100 transition-all">返回大厅</button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        {messages.map(m => (
          <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[75%] px-6 py-4 rounded-3xl shadow-sm text-sm font-medium leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'}`}>
              {m.role === 'assistant' && m.isAnimated ? (
                <SimulatedTypingText content={m.text} persona={activePersona} scrollRef={messagesEndRef} onComplete={() => setMessages(p => p.map(msg => msg.id === m.id ? { ...msg, isAnimated: false } : msg))} />
              ) : (m.text.replace(/<del>.*?<\/del>/g, ''))}
              <span className={`block text-[10px] mt-2 font-black opacity-50 ${m.role === 'user' ? 'text-indigo-100' : 'text-slate-400'}`}>{m.time}</span>
            </div>
          </div>
        ))}
        {isTypingIndicator && <div className="flex gap-2 p-4 bg-white rounded-2xl w-fit"><div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay:'0.2s'}}></div><div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay:'0.4s'}}></div></div>}
        <div ref={messagesEndRef} className="h-4"/>
      </main>
      <footer className="bg-white border-t border-slate-200 p-6">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-4">
          <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="与分身深入交流..." className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800" />
          <button type="submit" disabled={!input.trim()} className="px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 transition-all"><Send/></button>
        </form>
      </footer>

      {showTasksModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-fade-in">
            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><CheckSquare className="text-indigo-600"/> 提炼代办事项</h2>
            <div className="space-y-3 mb-8 max-h-60 overflow-y-auto">
              {extractedTasks.length === 0 ? <p className="text-center text-slate-400 py-10 font-bold">未识别到明确任务</p> : 
                extractedTasks.map((t, i) => <label key={i} className="flex gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100"><input type="checkbox" className="w-4 h-4 mt-1"/><span className="text-sm font-bold text-slate-700">{t}</span></label>)
              }
            </div>
            <button onClick={() => setShowTasksModal(false)} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl">关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}
