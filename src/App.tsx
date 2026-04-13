import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import Papa from 'papaparse';
import { Trophy, Users, History, RotateCcw, Play, UserCheck, Trash2, Settings, UserPlus, Search, X, FileUp, Info } from 'lucide-react';
import { participants as initialParticipants, Participant } from './data/participants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export default function App() {
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [availableParticipants, setAvailableParticipants] = useState<Participant[]>([]);
  const [winners, setWinners] = useState<Participant[]>([]);
  const [targetQuota, setTargetQuota] = useState(10);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showWinnerDialog, setShowWinnerDialog] = useState(false);
  const [lastWinners, setLastWinners] = useState<Participant[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [projectTitle, setProjectTitle] = useState('Lucky Draw');
  const [activeView, setActiveView] = useState<'draw' | 'instructions'>('draw');
  
  const [newMember, setNewMember] = useState({ name: '', title: '', department: '' });

  const drawTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitializedRef = useRef(false);

  // Initialize data
  useEffect(() => {
    const savedWinners = localStorage.getItem('lucky-draw-winners');
    const savedParticipants = localStorage.getItem('lucky-draw-participants');

    let currentAllParticipants = initialParticipants;
    let currentWinners: Participant[] = [];

    if (savedParticipants) {
      try {
        const parsed = JSON.parse(savedParticipants);
        // 防呆：localStorage 若是空陣列就視為無效，改用程式內預設名單
        if (Array.isArray(parsed) && parsed.length > 0) {
          currentAllParticipants = parsed;
        }
      } catch (e) {
        console.error("Failed to parse participants", e);
      }
    }
    setAllParticipants(currentAllParticipants);

    if (savedWinners) {
      try {
        currentWinners = JSON.parse(savedWinners);
        if (Array.isArray(currentWinners)) {
          setWinners(currentWinners);
          // 確保 targetQuota 不會小於已中獎人數
          setTargetQuota(prev => Math.max(prev, currentWinners.length));
        }
      } catch (e) {
        console.error("Failed to parse winners", e);
      }
    }

    const winnerIds = new Set(currentWinners.map(w => w.id));
    setAvailableParticipants(currentAllParticipants.filter(p => !winnerIds.has(p.id)));

    isInitializedRef.current = true;
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (drawTimeoutRef.current) {
        clearTimeout(drawTimeoutRef.current);
        drawTimeoutRef.current = null;
      }
    };
  }, []);

  // Save winners (init 完成前不寫入，避免覆蓋已存資料)
  useEffect(() => {
    if (!isInitializedRef.current) return;
    localStorage.setItem('lucky-draw-winners', JSON.stringify(winners));
  }, [winners]);

  // Save all participants (init 完成前不寫入，避免覆蓋已存資料)
  useEffect(() => {
    if (!isInitializedRef.current) return;
    localStorage.setItem('lucky-draw-participants', JSON.stringify(allParticipants));
  }, [allParticipants]);

  // Update document title
  useEffect(() => {
    document.title = projectTitle;
  }, [projectTitle]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Set project title based on filename
    const filename = file.name.replace(/\.[^/.]+$/, "");
    setProjectTitle(filename);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        
        // Map columns to Participant structure
        // If columns '姓名', '單位', '職稱' exist, use them, otherwise try common names
        const participants: Participant[] = data.map((row, index) => ({
          id: index + 1,
          name: row['姓名'] || row['Name'] || row['name'] || '',
          department: row['單位'] || row['Department'] || row['department'] || '',
          title: row['職稱'] || row['Title'] || row['title'] || '',
          subsidy: row['補助'] || row['Subsidy'] || row['subsidy'] || 'CSV匯入'
        })).filter(p => p.name); // Filter out rows without a name

        if (participants.length === 0) {
          alert('無法解析參與者資料，及請檢查 CSV 格式（欄位需包含：姓名、單位、職稱）');
          return;
        }

        setAllParticipants(participants);
        setAvailableParticipants(participants);
        setWinners([]); // Reset winners when new list is uploaded
        localStorage.removeItem('lucky-draw-winners');
        alert(`成功匯入 ${participants.length} 位參與者！`);
      },
      error: (error) => {
        console.error('CSV Parsing Error:', error);
        alert('解析 CSV 時發生錯誤。');
      }
    });
  };

  const startDraw = useCallback(() => {
    if (availableParticipants.length === 0 || isDrawing) return;

    setIsDrawing(true);
    let speed = 50;
    let count = 0;
    const maxCount = 40;
    let lastIndex = 0;

    const run = () => {
      const nextIndex = Math.floor(Math.random() * availableParticipants.length);
      lastIndex = nextIndex;
      setCurrentIndex(nextIndex);
      count++;

      if (count < maxCount) {
        if (count > maxCount * 0.7) speed += 20;
        drawTimeoutRef.current = setTimeout(run, speed);
      } else {
        drawTimeoutRef.current = null;
        finishDraw(lastIndex);
      }
    };

    run();
  }, [availableParticipants, isDrawing]);

  const finishDraw = (finalIndex: number) => {
    setIsDrawing(false); // 優先重置狀態，避免掛掉
    
    const winner = availableParticipants[finalIndex];
    if (!winner) return;

    setLastWinners([winner]);
    setWinners(prev => [winner, ...prev]);
    setAvailableParticipants(prev => prev.filter(p => p.id !== winner.id));
    setShowWinnerDialog(true);

    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#E63946', '#FFD700', '#1D3557']
    });
  };

  const resetDraw = () => {
    if (window.confirm('確定要重置所有抽獎紀錄嗎？')) {
      if (drawTimeoutRef.current) {
        clearTimeout(drawTimeoutRef.current);
        drawTimeoutRef.current = null;
      }
      setIsDrawing(false);
      setWinners([]);
      setAvailableParticipants(allParticipants);
      localStorage.removeItem('lucky-draw-winners');
    }
  };

  const removeWinner = (id: number) => {
    const winnerToRemove = winners.find(w => w.id === id);
    if (winnerToRemove) {
      setWinners(prev => prev.filter(w => w.id !== id));
      setAvailableParticipants(prev => {
        const existsInAll = allParticipants.find(p => p.id === id);
        if (existsInAll) {
          return [...prev, winnerToRemove].sort((a, b) => a.id - b.id);
        }
        return prev;
      });
    }
  };

  const addParticipant = () => {
    if (!newMember.name || !newMember.title || !newMember.department) {
      alert('請填寫完整資訊');
      return;
    }
    const duplicate = allParticipants.some(
      p => p.name === newMember.name && p.department === newMember.department
    );
    if (duplicate) {
      alert('該成員已存在於名單中');
      return;
    }
    const id = allParticipants.reduce((max, p) => Math.max(max, p.id), 0) + 1;
    const p: Participant = { ...newMember, id, subsidy: '手動新增' };
    setAllParticipants(prev => [...prev, p]);
    setAvailableParticipants(prev => [...prev, p]);
    setNewMember({ name: '', title: '', department: '' });
  };

  const deleteParticipant = (id: number) => {
    if (winners.some(w => w.id === id)) {
      alert('該成員已中獎，請先從中獎名單移除');
      return;
    }
    if (window.confirm('確定要刪除此成員嗎？')) {
      setAllParticipants(prev => prev.filter(p => p.id !== id));
      setAvailableParticipants(prev => prev.filter(p => p.id !== id));
    }
  };

  const filteredParticipants = allParticipants.filter(p => 
    p.name.includes(searchTerm) || 
    p.department.includes(searchTerm) || 
    p.title.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-slate-50 p-1 md:p-4 flex flex-col items-center">
      {/* Header */}
      <header className="w-full max-w-4xl mb-2 md:mb-6 text-center">
        <div
          className="inline-block bg-lucky-red text-white px-3 py-1.5 md:px-5 md:py-2 border-2 md:border-4 border-black brutal-shadow mb-2 md:mb-4"
        >
          <h1 className="text-2xl md:text-4xl font-black tracking-tighter uppercase">
            {projectTitle}
          </h1>
        </div>
        <p className="text-slate-600 font-medium text-xs md:text-sm">
          總人數: {allParticipants.length} | 剩餘: {availableParticipants.length}
        </p>
        
        <div className="mt-2 flex flex-wrap justify-center gap-2 md:gap-3">
          <Button 
            variant={activeView === 'draw' ? 'default' : 'outline'}
            className={`border-2 border-black brutal-shadow-hover font-bold ${activeView === 'draw' ? 'bg-black text-white' : 'bg-white'}`}
            onClick={() => setActiveView('draw')}
          >
            <Trophy className="mr-2 h-4 w-4" />
            抽獎現場
          </Button>
          <Button 
            variant={activeView === 'instructions' ? 'default' : 'outline'}
            className={`border-2 border-black brutal-shadow-hover font-bold ${activeView === 'instructions' ? 'bg-black text-white' : 'bg-white'}`}
            onClick={() => setActiveView('instructions')}
          >
            <Info className="mr-2 h-4 w-4" />
            操作說明
          </Button>
          <Button 
            variant="outline" 
            className="border-2 border-black brutal-shadow-hover bg-white font-bold"
            onClick={() => setShowSettings(true)}
          >
            <Settings className="mr-2 h-4 w-4" />
            管理名單
          </Button>
        </div>
      </header>

      {activeView === 'draw' ? (
        <main className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-6">
        {/* Left Column: Drawing Area */}
        <div className="lg:col-span-8 space-y-3 md:space-y-6">
          <Card className="border-2 md:border-4 border-black brutal-shadow overflow-hidden bg-white pt-0">
            <CardHeader className="bg-lucky-dark text-white border-b-2 md:border-b-4 border-black p-3 md:p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                    <Trophy className="text-lucky-gold h-4 w-4 md:h-5 md:w-5" />
                    抽獎舞台
                  </CardTitle>
                  <CardDescription className="text-slate-300 text-[10px] md:text-xs">
                    設定人數並開始隨機抽選
                  </CardDescription>
                </div>
                
                <div className="flex items-center gap-3 bg-white/10 p-2 rounded-lg border border-white/20">
                  <span className="text-sm font-bold whitespace-nowrap">目標總人數:</span>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-white hover:bg-white/20 border border-white/30"
                      onClick={() => setTargetQuota(prev => Math.max(winners.length, prev - 1))}
                      disabled={isDrawing}
                    >
                      -
                    </Button>
                    <input 
                      type="number" 
                      min={winners.length}
                      max={allParticipants.length}
                      value={targetQuota}
                      onChange={(e) => setTargetQuota(Math.max(winners.length, parseInt(e.target.value) || winners.length))}
                      className="w-16 bg-white text-black border-2 border-black font-black px-2 py-1 text-center"
                      disabled={isDrawing}
                    />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-white hover:bg-white/20 border border-white/30"
                      onClick={() => setTargetQuota(prev => Math.min(allParticipants.length, prev + 1))}
                      disabled={isDrawing}
                    >
                      +
                    </Button>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 bg-lucky-gold text-black border-2 border-black font-bold hover:bg-yellow-400"
                    onClick={() => setTargetQuota(prev => prev + 5)}
                    disabled={isDrawing}
                  >
                    +5
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-8 flex flex-col items-center justify-center min-h-[250px] md:min-h-[350px]">
              {/* Progress Bar */}
              <div className="w-full max-w-md mb-6 md:mb-10">
                <div className="flex justify-between mb-1.5 text-[10px] md:text-xs font-black uppercase tracking-wider">
                  <span>進度: {winners.length} / {targetQuota}</span>
                  <span>{targetQuota > 0 ? Math.round((winners.length / targetQuota) * 100) : 0}%</span>
                </div>
                <div className="h-3 md:h-5 w-full bg-slate-100 border-2 md:border-4 border-black brutal-shadow">
                  <div 
                    className="h-full bg-lucky-gold transition-all duration-500"
                    style={{ width: `${targetQuota > 0 ? Math.min(100, (winners.length / targetQuota) * 100) : 0}%` }}
                  />
                </div>
              </div>

              <div className="min-h-[180px] md:min-h-[220px] flex flex-col items-center justify-center">
                <div className="min-h-[180px] md:min-h-[250px] w-full flex flex-col items-center justify-center">
                  {isDrawing ? (
                    <div className="text-center">
                      <div className="text-3xl md:text-6xl font-black text-lucky-red mb-3 break-all px-4">
                        {availableParticipants[currentIndex]?.name || "抽選中..."}
                      </div>
                      <div className="text-sm md:text-lg text-slate-500 font-bold uppercase tracking-widest">
                        正在隨機抽選...
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-3 md:space-y-6 w-full">
                      <div className="w-16 h-16 md:w-24 md:h-24 bg-lucky-gold rounded-full border-2 md:border-4 border-black flex items-center justify-center mx-auto brutal-shadow">
                        <Trophy size={28} className="text-black md:hidden" />
                        <Trophy size={48} className="text-black hidden md:block" />
                      </div>
                      <div className="space-y-1 px-4">
                        <h2 className="text-lg md:text-2xl font-bold">準備好迎接驚喜了嗎？</h2>
                        <p className="text-xs md:text-slate-500">點擊下方按鈕，抽出下一位幸運得主！</p>
                      </div>
                      <Button
                        size="lg"
                        disabled={availableParticipants.length === 0 || winners.length >= targetQuota}
                        onClick={startDraw}
                        className="bg-lucky-red hover:bg-red-600 text-lg md:text-2xl font-black py-3 md:py-6 px-5 md:px-10 border-2 md:border-4 border-black brutal-shadow brutal-shadow-hover transition-all h-auto disabled:bg-slate-300 disabled:cursor-not-allowed disabled:shadow-none"
                      >
                        {winners.length >= targetQuota ? (
                          <div className="flex flex-col items-center">
                            <span className="text-slate-600">已達抽獎上限</span>
                            <span className="text-sm font-bold mt-1">請增加目標人數以繼續</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <Play className="h-8 w-8 fill-current" />
                            <span>抽出第 {winners.length + 1} 位</span>
                          </div>
                        )}
                      </Button>
                      
                      {winners.length >= targetQuota && availableParticipants.length > 0 && (
                        <div className="mt-6 flex justify-center gap-4">
                          <Button
                            onClick={() => setTargetQuota(prev => Math.min(allParticipants.length, prev + 1))}
                            className="bg-lucky-gold text-black border-2 border-black font-bold brutal-shadow-hover"
                          >
                            加抽 1 位
                          </Button>
                          <Button
                            onClick={() => setTargetQuota(prev => Math.min(allParticipants.length, prev + 5))}
                            className="bg-lucky-gold text-black border-2 border-black font-bold brutal-shadow-hover"
                          >
                            加抽 5 位
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats & Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <Card className="border-2 md:border-4 border-black brutal-shadow">
              <CardContent className="p-4 md:p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 md:p-3 bg-blue-100 rounded-lg border-2 border-black">
                    <Users className="text-blue-600 h-4 w-4 md:h-6 md:w-6" />
                  </div>
                  <div>
                    <div className="text-[10px] md:text-sm font-bold text-slate-500 uppercase">剩餘名額</div>
                    <div className="text-lg md:text-2xl font-black">{availableParticipants.length} 人</div>
                  </div>
                </div>
                <Button variant="outline" size="icon" className="border-2 border-black h-8 w-8" onClick={resetDraw}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
            <Card className="border-2 md:border-4 border-black brutal-shadow">
              <CardContent className="p-4 md:p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 md:p-3 bg-green-100 rounded-lg border-2 border-black">
                    <UserCheck className="text-green-600 h-4 w-4 md:h-6 md:w-6" />
                  </div>
                  <div>
                    <div className="text-[10px] md:text-sm font-bold text-slate-500 uppercase">已中獎人數</div>
                    <div className="text-lg md:text-2xl font-black">{winners.length} 人</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column: History & List */}
        <div className="lg:col-span-4 space-y-3 md:space-y-6 flex flex-col">
          <Card className="border-2 md:border-4 border-black brutal-shadow flex flex-col overflow-hidden bg-white pt-0">
            <CardHeader className="bg-white border-b-2 md:border-b-4 border-black p-3 md:p-4">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <History className="text-lucky-red h-4 w-4 md:h-5 md:w-5" />
                中獎名單
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-[250px] md:h-[50vh] md:min-h-[400px]">
                <div className="p-4 space-y-3">
                  {winners.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 font-medium italic">
                      尚無中獎紀錄
                    </div>
                  ) : (
                    winners.map((winner, idx) => (
                      <div
                        key={winner.id}
                        className="p-4 border-2 border-black bg-white brutal-shadow-hover flex items-center justify-between group"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-black text-lg">{winner.name}</span>
                            <Badge variant="secondary" className="bg-lucky-gold text-black border border-black text-[10px] px-1">
                              #{winners.length - idx}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-500 font-bold">
                            {winner.department} · {winner.title}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                          onClick={() => removeWinner(winner.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </main>
      ) : (
        <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="border-4 border-black brutal-shadow bg-white overflow-hidden pt-0">
            <CardHeader className="bg-lucky-dark text-white border-b-4 border-black p-4 md:p-8">
              <CardTitle className="text-xl md:text-3xl font-black flex items-center gap-3">
                <Info className="h-6 w-6 md:h-8 md:w-8 text-lucky-gold" />
                抽獎系統操作說明
              </CardTitle>
              <CardDescription className="text-slate-300 text-sm md:text-lg">
                請按照以下步驟開始您的抽獎活動
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-8 space-y-6 md:space-y-10">
              <section className="space-y-2 md:space-y-4">
                <h3 className="text-lg md:text-2xl font-black border-l-8 border-lucky-red pl-4">1. 準備參與者名單</h3>
                <p className="text-sm md:text-base text-slate-600 leading-relaxed pl-6">
                  請準備一個 <strong>CSV 檔案</strong>，其中第一列（Header）必須包含以下欄位名稱：
                </p>
                <div className="bg-slate-50 border-2 border-black p-2 md:p-4 ml-6 grid grid-cols-3 gap-2 md:gap-4 text-center text-xs md:text-base">
                  <div className="bg-white border-2 border-black p-1 md:p-2 font-bold">姓名</div>
                  <div className="bg-white border-2 border-black p-1 md:p-2 font-bold">單位</div>
                  <div className="bg-white border-2 border-black p-1 md:p-2 font-bold">職稱</div>
                </div>
                <p className="text-[10px] md:text-sm text-slate-500 pl-6 italic">* 檔案名稱將自動成為網站的新標題。</p>
              </section>

              <section className="space-y-2 md:space-y-4">
                <h3 className="text-lg md:text-2xl font-black border-l-8 border-lucky-red pl-4">2. 上傳檔案</h3>
                <p className="text-sm md:text-base text-slate-600 leading-relaxed pl-6">
                  點擊右上角的「<strong>管理名單</strong>」按鈕，選擇「<strong>上傳 CSV 檔案名單</strong>」。匯入成功後，系統會自動載入名單並重置抽獎狀態。
                </p>
              </section>

              <section className="space-y-2 md:space-y-4">
                <h3 className="text-lg md:text-2xl font-black border-l-8 border-lucky-red pl-4">3. 設定抽獎人數</h3>
                <p className="text-sm md:text-base text-slate-600 leading-relaxed pl-6">
                  在「<strong>抽獎舞台</strong>」區域，您可以透過輸入框或 「+/-」按鈕來設定本次活動預計要抽出的中獎總人數。
                </p>
              </section>

              <section className="space-y-2 md:space-y-4">
                <h3 className="text-lg md:text-2xl font-black border-l-8 border-lucky-red pl-4">4. 開始抽獎</h3>
                <p className="text-sm md:text-base text-slate-600 leading-relaxed pl-6">
                  點擊正中間醒目的「<strong>抽出第 X 位</strong>」按鈕開始隨機動畫，系統會自動從尚未中獎的名單中選出一位幸運兒！
                </p>
              </section>

              <div className="bg-lucky-gold/10 border-4 border-dashed border-lucky-gold p-4 md:p-6 rounded-xl">
                <h4 className="font-black text-lucky-dark mb-2 flex items-center gap-2 text-sm md:text-base">
                  <Settings className="h-4 w-4 md:h-5 md:w-5" /> 小撇步
                </h4>
                <ul className="list-disc list-inside text-xs md:text-base text-slate-700 space-y-1 ml-2">
                  <li><strong>手動新增：</strong>若有名單遺漏，可隨時在「管理名單」中手動添加。</li>
                  <li><strong>即時搜尋：</strong>可以在名單管理中快速搜尋特定成員。</li>
                  <li><strong>自動存檔：</strong>抽獎結果會自動儲存在您的瀏覽器中，重新整理網頁也不會消失。</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-4xl border-4 border-black p-0 overflow-hidden bg-white max-h-[90vh] flex flex-col">
          <DialogHeader className="p-4 md:p-6 bg-lucky-dark text-white border-b-4 border-black flex flex-col md:flex-row items-center md:items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-lg md:text-2xl font-black flex items-center gap-2">
                <Settings className="h-5 w-5 md:h-6 md:w-6" />
                名單管理系統
              </DialogTitle>
              <DialogDescription className="text-xs md:text-slate-300">
                您可以檢查、新增、刪除或上傳抽獎成員名單
              </DialogDescription>
            </div>
            <div className="flex w-full md:w-auto gap-2">
              <label className="cursor-pointer w-full md:w-auto">
                <div className="bg-lucky-gold hover:bg-yellow-400 text-black border-2 border-black font-bold py-1.5 px-3 md:py-2 md:px-4 flex items-center justify-center gap-2 transition-colors brutal-shadow-hover text-sm md:text-base">
                  <FileUp className="h-4 w-4" />
                  上傳 CSV 名單
                </div>
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </DialogHeader>

          <div className="p-6 flex-1 overflow-hidden flex flex-col gap-6">
            {/* Add Member Form */}
            <div className="bg-slate-50 p-4 border-2 border-black brutal-shadow">
              <h3 className="font-black mb-3 flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> 新增成員
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input 
                  placeholder="姓名" 
                  className="border-2 border-black p-2 text-sm"
                  value={newMember.name}
                  onChange={e => setNewMember({...newMember, name: e.target.value})}
                />
                <input 
                  placeholder="單位" 
                  className="border-2 border-black p-2 text-sm"
                  value={newMember.department}
                  onChange={e => setNewMember({...newMember, department: e.target.value})}
                />
                <input 
                  placeholder="職稱" 
                  className="border-2 border-black p-2 text-sm"
                  value={newMember.title}
                  onChange={e => setNewMember({...newMember, title: e.target.value})}
                />
                <Button onClick={addParticipant} className="bg-lucky-red text-white border-2 border-black font-bold">
                  確認新增
                </Button>
              </div>
            </div>

            {/* Search & List */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input 
                  placeholder="搜尋姓名、單位或職稱..." 
                  className="w-full border-2 border-black p-2 pl-10 text-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <ScrollArea className="flex-1 border-2 border-black">
                <div className="divide-y-2 divide-slate-100">
                  {filteredParticipants.map(p => {
                    const isWinner = winners.some(w => w.id === p.id);
                    return (
                      <div key={p.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{p.name}</span>
                            {isWinner && <Badge className="bg-lucky-gold text-black text-[10px] h-4">已中獎</Badge>}
                          </div>
                          <div className="text-xs text-slate-500">{p.department} · {p.title}</div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-slate-300 hover:text-red-500"
                          onClick={() => deleteParticipant(p.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                  {filteredParticipants.length === 0 && (
                    <div className="p-8 text-center text-slate-400 italic">找不到符合的成員</div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t-4 border-black flex justify-between items-center">
            <Button onClick={() => {
              if (window.confirm('確定要清除目前的自訂名單，並重設為空嗎？')) {
                setAllParticipants([]);
                setAvailableParticipants([]);
                setWinners([]);
                localStorage.removeItem('lucky-draw-participants');
                localStorage.removeItem('lucky-draw-winners');
              }
            }} variant="outline" className="border-2 border-black text-red-600 font-bold hover:bg-red-50">
              <RotateCcw className="mr-2 h-4 w-4" />
              清空名單
            </Button>
            <Button onClick={() => setShowSettings(false)} className="bg-black text-white border-2 border-black font-bold">
              關閉視窗
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showWinnerDialog} onOpenChange={setShowWinnerDialog}>
        <DialogContent className="sm:max-w-md border-8 border-black p-0 overflow-hidden bg-lucky-gold">
          <div className="p-12 text-center space-y-6">
            <div
              className="w-24 h-24 bg-white rounded-full border-4 border-black flex items-center justify-center mx-auto mb-4"
            >
              <Trophy size={48} className="text-lucky-red" />
            </div>
            
            <DialogHeader>
              <DialogTitle className="text-4xl font-black text-black uppercase tracking-tighter text-center">
                恭喜中獎！
              </DialogTitle>
              <DialogDescription className="text-black/70 font-bold text-center">
                幸運之神降臨在您身上
              </DialogDescription>
            </DialogHeader>

            <div className="bg-white border-4 border-black p-4 brutal-shadow max-h-[40vh] overflow-y-auto">
              <div className="grid grid-cols-1 gap-4">
                {lastWinners.map((winner) => (
                  <div key={winner.id} className="border-b-2 border-slate-100 last:border-0 pb-2 last:pb-0">
                    <div className="text-3xl font-black text-lucky-red">
                      {winner.name}
                    </div>
                    <div className="text-sm font-bold text-slate-600">
                      {winner.department} | {winner.title}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={() => setShowWinnerDialog(false)}
              className="w-full bg-black text-white hover:bg-slate-800 font-black py-6 text-xl border-2 border-white"
            >
              太棒了！
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <footer className="mt-4 text-slate-400 text-[10px] md:text-xs font-medium pb-4 text-center">
        &copy; {projectTitle} | 僅供內部活動使用
      </footer>
    </div>
  );
}
