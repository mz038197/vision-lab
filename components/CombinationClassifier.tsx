
import React, { useState, useEffect } from 'react';

interface CombinationRule {
  id: string;
  faceLabel: string;
  handLabel: string;
  bodyLabel: string;
  imageLabel: string;
  resultLabel: string;
  enabled: boolean;
}

interface CombinationClassifierProps {
  faceResult: string;
  handResult: string;
  bodyResult: string;
  imageResult: string;
  activeModes: {
    face: boolean;
    hand: boolean;
    body: boolean;
    classifier: boolean;
  };
}

const CombinationClassifier: React.FC<CombinationClassifierProps> = ({
  faceResult,
  handResult,
  bodyResult,
  imageResult,
  activeModes
}) => {
  const STORAGE_KEY = 'visionlab-combination-rules';
  
  // Load rules from localStorage on mount
  const [rules, setRules] = useState<CombinationRule[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (error) {
      console.error('Failed to load rules from localStorage:', error);
    }
    return [];
  });
  
  const [newRule, setNewRule] = useState({
    faceLabel: '',
    handLabel: '',
    bodyLabel: '',
    imageLabel: '',
    resultLabel: ''
  });
  const [matchedRule, setMatchedRule] = useState<CombinationRule | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRule, setEditingRule] = useState<CombinationRule | null>(null);

  // Save rules to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    } catch (error) {
      console.error('Failed to save rules to localStorage:', error);
    }
  }, [rules]);

  // Check for matching rules
  useEffect(() => {
    const checkRules = () => {
      for (const rule of rules) {
        if (!rule.enabled) continue;

        let matches = true;

        // Check face condition (if face mode is active and rule has face condition)
        if (rule.faceLabel && activeModes.face) {
          if (faceResult.toLowerCase() !== rule.faceLabel.toLowerCase()) {
            matches = false;
          }
        }

        // Check hand condition (if hand mode is active and rule has hand condition)
        if (rule.handLabel && activeModes.hand) {
          if (handResult.toLowerCase() !== rule.handLabel.toLowerCase()) {
            matches = false;
          }
        }

        // Check body condition (if body mode is active and rule has body condition)
        if (rule.bodyLabel && activeModes.body) {
          if (bodyResult.toLowerCase() !== rule.bodyLabel.toLowerCase()) {
            matches = false;
          }
        }

        // Check image condition (if classifier mode is active and rule has image condition)
        if (rule.imageLabel && activeModes.classifier) {
          if (imageResult.toLowerCase() !== rule.imageLabel.toLowerCase()) {
            matches = false;
          }
        }

        // Check if at least one condition is being checked
        const hasCondition = 
          (rule.faceLabel && activeModes.face) ||
          (rule.handLabel && activeModes.hand) ||
          (rule.bodyLabel && activeModes.body) ||
          (rule.imageLabel && activeModes.classifier);

        if (matches && hasCondition) {
          setMatchedRule(rule);
          return;
        }
      }
      setMatchedRule(null);
    };

    checkRules();
  }, [faceResult, handResult, bodyResult, imageResult, rules, activeModes]);

  const addRule = () => {
    if (!newRule.resultLabel) {
      alert('請輸入最終類別名稱');
      return;
    }

    if (!newRule.faceLabel && !newRule.handLabel && !newRule.bodyLabel && !newRule.imageLabel) {
      alert('至少需要設定一個條件');
      return;
    }

    const rule: CombinationRule = {
      id: Date.now().toString(),
      faceLabel: newRule.faceLabel,
      handLabel: newRule.handLabel,
      bodyLabel: newRule.bodyLabel,
      imageLabel: newRule.imageLabel,
      resultLabel: newRule.resultLabel,
      enabled: true
    };

    setRules([...rules, rule]);
    setNewRule({ faceLabel: '', handLabel: '', bodyLabel: '', imageLabel: '', resultLabel: '' });
    setShowAddForm(false);
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const clearAllRules = () => {
    if (rules.length === 0) return;
    
    if (window.confirm(`確定要清空所有 ${rules.length} 條規則嗎？此操作無法復原。`)) {
      setRules([]);
      setMatchedRule(null);
    }
  };

  const toggleRule = (id: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const startEdit = (rule: CombinationRule) => {
    setEditingRule(rule);
    setShowAddForm(false);
  };

  const updateRule = () => {
    if (!editingRule) return;

    if (!editingRule.resultLabel) {
      alert('請輸入最終類別名稱');
      return;
    }

    if (!editingRule.faceLabel && !editingRule.handLabel && !editingRule.bodyLabel && !editingRule.imageLabel) {
      alert('至少需要設定一個條件');
      return;
    }

    setRules(rules.map(r => r.id === editingRule.id ? editingRule : r));
    setEditingRule(null);
  };

  const cancelEdit = () => {
    setEditingRule(null);
  };

  const exportRules = () => {
    const dataStr = JSON.stringify(rules, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'combination-rules.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const importRules = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          setRules(imported);
          alert(`成功導入 ${imported.length} 條規則`);
        }
      } catch (error) {
        alert('導入失敗：文件格式錯誤');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className="w-full bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl flex flex-col">
      {/* Header with Result Display */}
      <div className="bg-gray-800 p-4 border-b border-gray-700 flex-none">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-white">組合識別器</h3>
          <span className="text-xs bg-purple-600/20 text-purple-400 px-2 py-1 rounded">
            {rules.filter(r => r.enabled).length} 規則啟用
          </span>
        </div>

        {/* Matched Result Display */}
        <div className="bg-gray-900 rounded-lg p-4 text-center border-2 border-gray-700 min-h-[80px] flex flex-col justify-center">
          {matchedRule ? (
            <>
              <p className="text-gray-500 text-xs mb-1">✅ 組合匹配</p>
              <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 animate-pulse">
                {matchedRule.resultLabel}
              </h2>
              <div className="mt-2 flex gap-2 justify-center flex-wrap text-xs">
                {matchedRule.faceLabel && (
                  <span className="bg-cyan-900/30 text-cyan-300 px-2 py-1 rounded">
                    👤 {matchedRule.faceLabel}
                  </span>
                )}
                {matchedRule.handLabel && (
                  <span className="bg-orange-900/30 text-orange-300 px-2 py-1 rounded">
                    ✋ {matchedRule.handLabel}
                  </span>
                )}
                {matchedRule.bodyLabel && (
                  <span className="bg-green-900/30 text-green-300 px-2 py-1 rounded">
                    🏃 {matchedRule.bodyLabel}
                  </span>
                )}
                {matchedRule.imageLabel && (
                  <span className="bg-purple-900/30 text-purple-300 px-2 py-1 rounded">
                    🔍 {matchedRule.imageLabel}
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-sm italic">等待條件匹配...</p>
          )}
        </div>

        {/* Current Detection Results */}
        <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
          <div className={`p-2 rounded ${activeModes.face ? 'bg-cyan-900/20 border border-cyan-700/50' : 'bg-gray-800/50 border border-gray-700'}`}>
            <div className="text-gray-400 mb-1">Face</div>
            <div className={`font-medium truncate ${activeModes.face ? 'text-cyan-300' : 'text-gray-600'}`}>
              {activeModes.face ? (faceResult || '-') : '未啟用'}
            </div>
          </div>
          <div className={`p-2 rounded ${activeModes.hand ? 'bg-orange-900/20 border border-orange-700/50' : 'bg-gray-800/50 border border-gray-700'}`}>
            <div className="text-gray-400 mb-1">Hand</div>
            <div className={`font-medium truncate ${activeModes.hand ? 'text-orange-300' : 'text-gray-600'}`}>
              {activeModes.hand ? (handResult || '-') : '未啟用'}
            </div>
          </div>
          <div className={`p-2 rounded ${activeModes.body ? 'bg-green-900/20 border border-green-700/50' : 'bg-gray-800/50 border border-gray-700'}`}>
            <div className="text-gray-400 mb-1">Body</div>
            <div className={`font-medium truncate ${activeModes.body ? 'text-green-300' : 'text-gray-600'}`}>
              {activeModes.body ? (bodyResult || '-') : '未啟用'}
            </div>
          </div>
          <div className={`p-2 rounded ${activeModes.classifier ? 'bg-purple-900/20 border border-purple-700/50' : 'bg-gray-800/50 border border-gray-700'}`}>
            <div className="text-gray-400 mb-1">Image</div>
            <div className={`font-medium truncate ${activeModes.classifier ? 'text-purple-300' : 'text-gray-600'}`}>
              {activeModes.classifier ? (imageResult || '-') : '未啟用'}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="overflow-y-auto p-4 space-y-4 flex-none max-h-[400px]">
        {/* Add Rule Button */}
        {!showAddForm && !editingRule && (
          <button
            onClick={() => {
              setShowAddForm(true);
              setEditingRule(null);
            }}
            className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新增組合規則
          </button>
        )}

        {/* Edit Rule Form */}
        {editingRule && (
          <div className="bg-gray-800 rounded-lg p-4 border-2 border-blue-600 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                編輯規則
              </h4>
              <button
                onClick={cancelEdit}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">👤 Face 條件 (可選)</label>
              <input
                type="text"
                value={editingRule.faceLabel}
                onChange={(e) => setEditingRule({ ...editingRule, faceLabel: e.target.value })}
                placeholder="例如: Happy"
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">✋ Hand 條件 (可選)</label>
              <input
                type="text"
                value={editingRule.handLabel}
                onChange={(e) => setEditingRule({ ...editingRule, handLabel: e.target.value })}
                placeholder="例如: Peace"
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">🏃 Body 條件 (可選)</label>
              <input
                type="text"
                value={editingRule.bodyLabel}
                onChange={(e) => setEditingRule({ ...editingRule, bodyLabel: e.target.value })}
                placeholder="例如: Standing"
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">🔍 Image 條件 (可選)</label>
              <input
                type="text"
                value={editingRule.imageLabel}
                onChange={(e) => setEditingRule({ ...editingRule, imageLabel: e.target.value })}
                placeholder="例如: Cat"
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">🎯 最終類別 (必填)</label>
              <input
                type="text"
                value={editingRule.resultLabel}
                onChange={(e) => setEditingRule({ ...editingRule, resultLabel: e.target.value })}
                placeholder="例如: 吃飯"
                className="w-full bg-gray-900 border border-blue-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={updateRule}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors text-sm"
              >
                保存修改
              </button>
              <button
                onClick={cancelEdit}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium transition-colors text-sm"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* Add Rule Form */}
        {showAddForm && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-white">新增規則</h4>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">👤 Face 條件 (可選)</label>
              <input
                type="text"
                value={newRule.faceLabel}
                onChange={(e) => setNewRule({ ...newRule, faceLabel: e.target.value })}
                placeholder="例如: Happy"
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">✋ Hand 條件 (可選)</label>
              <input
                type="text"
                value={newRule.handLabel}
                onChange={(e) => setNewRule({ ...newRule, handLabel: e.target.value })}
                placeholder="例如: Peace"
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">🏃 Body 條件 (可選)</label>
              <input
                type="text"
                value={newRule.bodyLabel}
                onChange={(e) => setNewRule({ ...newRule, bodyLabel: e.target.value })}
                placeholder="例如: Standing"
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">🔍 Image 條件 (可選)</label>
              <input
                type="text"
                value={newRule.imageLabel}
                onChange={(e) => setNewRule({ ...newRule, imageLabel: e.target.value })}
                placeholder="例如: Cat"
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">🎯 最終類別 (必填)</label>
              <input
                type="text"
                value={newRule.resultLabel}
                onChange={(e) => setNewRule({ ...newRule, resultLabel: e.target.value })}
                placeholder="例如: 吃飯"
                className="w-full bg-gray-900 border border-purple-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={addRule}
                className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-medium transition-colors text-sm"
              >
                添加
              </button>
              <button
                onClick={() => {
                  setNewRule({ faceLabel: '', handLabel: '', bodyLabel: '', imageLabel: '', resultLabel: '' });
                  setShowAddForm(false);
                }}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium transition-colors text-sm"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* Rules List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              規則列表 ({rules.length})
            </label>
            {rules.length > 0 && (
              <button
                onClick={clearAllRules}
                className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
                title="清空所有規則"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                清空全部
              </button>
            )}
          </div>
          {rules.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm border border-dashed border-gray-700 rounded-lg">
              尚無規則，請新增組合規則
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`bg-gray-800 rounded-lg p-3 border transition-all ${
                    rule.enabled ? 'border-gray-700' : 'border-gray-800 opacity-50'
                  } ${matchedRule?.id === rule.id ? 'ring-2 ring-purple-500 bg-purple-900/20' : ''}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleRule(rule.id)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          rule.enabled
                            ? 'bg-purple-600 border-purple-600'
                            : 'bg-gray-700 border-gray-600'
                        }`}
                      >
                        {rule.enabled && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <span className="font-bold text-purple-300">{rule.resultLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(rule)}
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                        title="編輯規則"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                        title="刪除規則"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {rule.faceLabel && (
                      <span className="bg-cyan-900/30 text-cyan-300 px-2 py-1 rounded">
                        👤 {rule.faceLabel}
                      </span>
                    )}
                    {rule.handLabel && (
                      <span className="bg-orange-900/30 text-orange-300 px-2 py-1 rounded">
                        ✋ {rule.handLabel}
                      </span>
                    )}
                    {rule.bodyLabel && (
                      <span className="bg-green-900/30 text-green-300 px-2 py-1 rounded">
                        🏃 {rule.bodyLabel}
                      </span>
                    )}
                    {rule.imageLabel && (
                      <span className="bg-purple-900/30 text-purple-300 px-2 py-1 rounded">
                        🔍 {rule.imageLabel}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-700 bg-gray-800 space-y-2 flex-none">
        <div className="flex gap-2">
          <button
            onClick={exportRules}
            disabled={rules.length === 0}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            導出規則
          </button>

          <label className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-1 cursor-pointer">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            導入規則
            <input
              type="file"
              accept=".json"
              onChange={importRules}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
};

export default CombinationClassifier;

