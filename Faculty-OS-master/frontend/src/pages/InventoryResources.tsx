import { SharedChatInterface } from '../components/SharedChatInterface';
import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Input } from '../components/Common';
import { Package, Send, Wrench, Key, Book, AlertTriangle, Edit2, Plus } from 'lucide-react';
import { api, type ChatMessage } from '../services/api';

export const InventoryResources: React.FC<{ user: any }> = ({ user }) => {
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [streamingTraces, setStreamingTraces] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [assets, setAssets] = useState<any[]>([]);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);

  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [assetFormData, setAssetFormData] = useState({ name: '', asset_type: '', serial_number: '', location: '', status: '' });

  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [editingLicenseId, setEditingLicenseId] = useState<number | null>(null);
  const [licenseFormData, setLicenseFormData] = useState({ name: '', vendor: '', license_key: '', seats_total: '' });

  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [bookFormData, setBookFormData] = useState({ title: '', author: '', edition: '', status: '' });

  const handleSendChat = async (directMessage?: string) => {
    const msgContent = directMessage || chatInput.trim();
    if (!msgContent || isLoading) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: msgContent, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setChatInput('');
    setIsLoading(true);
    setStreamingText('');
    setStreamingTraces([]);
    
    let fullText = '';
    
    try {
      await api.streamChat(
        'agent10',
        msgContent,
        newHistory,
        (chunk) => {
          fullText += chunk;
          setStreamingText(fullText);
        },
        (trace) => {
          setStreamingTraces(prev => {
            const existing = prev.findIndex(t => t.name === trace.name);
            if (existing >= 0) {
              const newTraces = [...prev];
              newTraces[existing] = trace;
              return newTraces;
            }
            return [...prev, trace];
          });
        },
        (toolCalls, richData) => {
          setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: fullText, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), richData }]);
          setStreamingText('');
          setStreamingTraces([]);
          setIsLoading(false);
        },
        (err) => {
          console.error(err);
          setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Sorry, there was an error processing your request.', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
          setIsLoading(false);
        }
      );
    } catch (error) {
      console.error(error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingText, streamingTraces]);

  const loadData = async () => {
    try {
      const a = await api.getLabAssets();
      const l = await api.getSoftwareLicenses();
      const b = await api.getBookRequisitions();
      setAssets(a);
      setLicenses(l);
      setBooks(b);
    } catch (error) {
      console.error("Failed to fetch inventory data", error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssetSubmit = async () => {
    if (editingAssetId) await (api as any).editLabAsset(editingAssetId, assetFormData);
    else await (api as any).addLabAsset(assetFormData);
    await loadData();
    setIsAssetModalOpen(false);
    setEditingAssetId(null);
    setAssetFormData({ name: '', asset_type: '', serial_number: '', location: '', status: '' });
  };

  const handleLicenseSubmit = async () => {
    if (editingLicenseId) await (api as any).editSoftwareLicense(editingLicenseId, licenseFormData);
    else await (api as any).addSoftwareLicense(licenseFormData);
    await loadData();
    setIsLicenseModalOpen(false);
    setEditingLicenseId(null);
    setLicenseFormData({ name: '', vendor: '', license_key: '', seats_total: '' });
  };

  const handleBookSubmit = async () => {
    if (editingBookId) await (api as any).editBookRequisition(editingBookId, bookFormData);
    else await (api as any).addBookRequisition(bookFormData);
    await loadData();
    setIsBookModalOpen(false);
    setEditingBookId(null);
    setBookFormData({ title: '', author: '', edition: '', status: '' });
  };

  
  const renderInteractiveChoices = (data: any) => {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {data.choices.map((choice: any, idx: number) => (
          <button
            key={idx}
            onClick={() => handleSendChat(choice.value)}
            className="text-xs bg-surface border border-border hover:border-accent-500 hover:text-accent-500 transition py-1.5 px-3 rounded flex items-center gap-1.5 shadow-sm text-ink font-medium"
          >
            {choice.label}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold text-ink">Inventory & Resources</h2>
          <p className="text-xs text-ink-muted">Manage lab equipment, software licenses, and book requisitions.</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Left/Middle Content */}
        <div className="xl:col-span-3 flex flex-col gap-4 overflow-y-auto pr-2">
          {/* Dashboard Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[ 
              { label: 'Lab Assets', value: '450', icon: Package },
              { label: 'Active Licenses', value: '12', icon: Key },
              { label: 'Pending Repairs', value: '3', icon: AlertTriangle },
              { label: 'Book Requests', value: '8', icon: Book }
            ].map((stat, i) => (
              <Card key={i} className="p-4 bg-surface border-border flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-ink-muted uppercase tracking-wider mb-1">{stat.label}</div>
                  <div className="text-2xl font-display font-bold text-ink">{stat.value}</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-accent-500/10 flex items-center justify-center">
                  <stat.icon className="text-accent-500" size={16} />
                </div>
              </Card>
            ))}
          </div>

          {/* Assets, Licenses & Books */}
          <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
            <Card className="p-4 flex flex-col bg-surface border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2"><Key size={14} className="text-accent-500" /> Software Licenses</h3>
                <Button size="sm" onClick={() => {
                  setEditingLicenseId(null);
                  setLicenseFormData({ name: '', vendor: '', license_key: '', seats_total: '' });
                  setIsLicenseModalOpen(true);
                }} className="h-7 text-xs bg-accent-500 text-black hover:bg-accent-600">
                  <Plus size={14} className="mr-1" /> Add
                </Button>
              </div>
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto min-h-[100px]">
                {licenses.length === 0 ? (
                  <div className="flex-1 text-xs text-ink-muted flex items-center justify-center border-2 border-dashed border-border rounded h-full min-h-[100px]">
                    No licenses found
                  </div>
                ) : (
                  licenses.map((l, i) => (
                    <div key={i} className="p-3 rounded-lg bg-paper border border-border flex justify-between items-center group">
                      <div>
                        <div className="text-sm font-bold text-ink">{l.software_name || l.name || 'Software'}</div>
                        <div className="text-xs text-ink-muted">Expires: {l.expiry_date || 'N/A'} | Keys: {l.keys_available || l.seats_total || 0}</div>
                      </div>
                      <Button size="sm" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2 bg-transparent hover:bg-surface border-border" onClick={() => {
                        setEditingLicenseId(l.id);
                        setLicenseFormData({ name: l.software_name || l.name || '', vendor: l.vendor || '', license_key: l.license_key || '', seats_total: l.seats_total?.toString() || '' });
                        setIsLicenseModalOpen(true);
                      }}>
                        <Edit2 size={12} className="text-ink" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Card>
            
            <Card className="p-4 flex flex-col bg-surface border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2"><Package size={14} className="text-accent-500" /> Lab Assets</h3>
                <Button size="sm" onClick={() => {
                  setEditingAssetId(null);
                  setAssetFormData({ name: '', asset_type: '', serial_number: '', location: '', status: '' });
                  setIsAssetModalOpen(true);
                }} className="h-7 text-xs bg-accent-500 text-black hover:bg-accent-600">
                  <Plus size={14} className="mr-1" /> Add
                </Button>
              </div>
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto min-h-[100px]">
                {assets.length === 0 ? (
                  <div className="flex-1 text-xs text-ink-muted flex items-center justify-center border-2 border-dashed border-border rounded h-full min-h-[100px]">
                    No assets found
                  </div>
                ) : (
                  assets.map((a, i) => (
                    <div key={i} className="p-3 rounded-lg bg-paper border border-border flex justify-between items-center group">
                      <div>
                        <div className="text-sm font-bold text-ink">{a.item_name || a.name || 'Asset'}</div>
                        <div className="text-xs text-ink-muted">Qty: {a.quantity || 0} | Status: {a.status || 'Good'}</div>
                      </div>
                      <Button size="sm" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2 bg-transparent hover:bg-surface border-border" onClick={() => {
                        setEditingAssetId(a.id);
                        setAssetFormData({ name: a.item_name || a.name || '', asset_type: a.asset_type || '', serial_number: a.serial_number || '', location: a.location || '', status: a.status || '' });
                        setIsAssetModalOpen(true);
                      }}>
                        <Edit2 size={12} className="text-ink" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Card>
            
            <Card className="p-4 flex flex-col bg-surface border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2"><Book size={14} className="text-accent-500" /> Book Requisitions</h3>
                <Button size="sm" onClick={() => {
                  setEditingBookId(null);
                  setBookFormData({ title: '', author: '', edition: '', status: '' });
                  setIsBookModalOpen(true);
                }} className="h-7 text-xs bg-accent-500 text-black hover:bg-accent-600">
                  <Plus size={14} className="mr-1" /> Add
                </Button>
              </div>
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto min-h-[100px]">
                {books.length === 0 ? (
                  <div className="flex-1 text-xs text-ink-muted flex items-center justify-center border-2 border-dashed border-border rounded h-full min-h-[100px]">
                    No requisitions found
                  </div>
                ) : (
                  books.map((b, i) => (
                    <div key={i} className="p-3 rounded-lg bg-paper border border-border flex justify-between items-center group">
                      <div>
                        <div className="text-sm font-bold text-ink">{b.title || 'Book Title'}</div>
                        <div className="text-xs text-ink-muted">Author: {b.author || 'Author'} | Status: {b.status || 'Pending'}</div>
                      </div>
                      <Button size="sm" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2 bg-transparent hover:bg-surface border-border" onClick={() => {
                        setEditingBookId(b.id);
                        setBookFormData({ title: b.title || '', author: b.author || '', edition: b.edition || '', status: b.status || '' });
                        setIsBookModalOpen(true);
                      }}>
                        <Edit2 size={12} className="text-ink" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Right Side Chat */}
        <Card className="xl:col-span-1 flex flex-col border border-accent-500/30 bg-surface/96 overflow-hidden p-0">
          <div className="bg-gradient-to-r from-accent-900/50 to-cyan-900/50 px-4 py-3 flex items-center gap-3 border-b border-accent-500/30">
            <div className="w-8 h-8 rounded-full bg-accent-500 flex items-center justify-center shadow-lg">
              <Package size={16} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-ink">Inventory AI</div>
              <div className="text-[9px] text-accent-300 font-mono">Ready to assist</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {chatMessages.length === 0 && !streamingText && (
              <div className="flex gap-2 w-[85%]">
                <div className="w-5 h-5 rounded-full bg-accent-500 flex items-center justify-center shrink-0">
                  <Package size={10} className="text-white" />
                </div>
                <div className="bg-accent-500/10 text-ink text-xs p-2.5 rounded-2xl rounded-tl-sm border border-accent-500/20">
                  Hello! I am your Inventory & Resources AI. I can track license expirations, draft book requisition forms, or log maintenance tickets for broken lab equipment.
                </div>
              </div>
            )}
            
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex gap-2 w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-500' : 'bg-accent-500'}`}>
                  {msg.role === 'user' ? <div className="text-[10px] text-white">U</div> : <Package size={10} className="text-white" />}
                </div>
                <div className={`text-xs p-2.5 rounded-2xl border ${
                  msg.role === 'user' 
                    ? 'bg-blue-500/10 text-ink rounded-tr-sm border-blue-500/20' 
                    : 'bg-accent-500/10 text-ink rounded-tl-sm border-accent-500/20'
                }`}>
                  <div className="prose prose-invert max-w-none prose-sm whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}

            {(streamingText || streamingTraces.length > 0) && (
              <div className="flex gap-2 w-[85%]">
                <div className="w-5 h-5 rounded-full bg-accent-500 flex items-center justify-center shrink-0">
                  <Package size={10} className="text-white" />
                </div>
                <div className="flex flex-col gap-2 w-full">
                  {streamingTraces.map((trace, idx) => (
                    <div key={idx} className="bg-surface border border-border rounded p-2 text-[10px] font-mono text-ink-muted">
                      &gt; {trace.action}: {trace.input}
                    </div>
                  ))}
                  {streamingText && (
                    <div className="bg-accent-500/10 text-ink text-xs p-2.5 rounded-2xl rounded-tl-sm border border-accent-500/20">
                      <div className="prose prose-invert max-w-none prose-sm whitespace-pre-wrap">{streamingText}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t border-border/60 bg-surface">
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                placeholder="Ask Inventory AI..."
                className="flex-1 bg-paper text-xs rounded-xl"
                disabled={isLoading}
              />
              <Button 
                size="sm" 
                className="bg-accent-500 text-black hover:bg-accent-600 rounded-xl" 
                onClick={() => handleSendChat()} 
                disabled={isLoading}
              >
                <Send size={14} />
              </Button>
            </div>
          </div>
        </Card>
      </div>
      {isAssetModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md flex flex-col gap-4 shadow-xl">
            <h3 className="text-lg font-bold text-ink">{editingAssetId ? 'Edit Lab Asset' : 'Add Lab Asset'}</h3>
            <div className="flex flex-col gap-3">
              <Input placeholder="Asset Name" value={assetFormData.name} onChange={e => setAssetFormData({...assetFormData, name: e.target.value})} className="bg-paper border-border" />
              <Input placeholder="Asset Type" value={assetFormData.asset_type} onChange={e => setAssetFormData({...assetFormData, asset_type: e.target.value})} className="bg-paper border-border" />
              <Input placeholder="Serial Number" value={assetFormData.serial_number} onChange={e => setAssetFormData({...assetFormData, serial_number: e.target.value})} className="bg-paper border-border" />
              <Input placeholder="Location" value={assetFormData.location} onChange={e => setAssetFormData({...assetFormData, location: e.target.value})} className="bg-paper border-border" />
              <Input placeholder="Status" value={assetFormData.status} onChange={e => setAssetFormData({...assetFormData, status: e.target.value})} className="bg-paper border-border" />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="ghost" onClick={() => setIsAssetModalOpen(false)}>Cancel</Button>
              <Button className="bg-accent-500 text-black hover:bg-accent-600" onClick={handleAssetSubmit}>Submit</Button>
            </div>
          </div>
        </div>
      )}

      {isLicenseModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md flex flex-col gap-4 shadow-xl">
            <h3 className="text-lg font-bold text-ink">{editingLicenseId ? 'Edit License' : 'Add License'}</h3>
            <div className="flex flex-col gap-3">
              <Input placeholder="Software Name" value={licenseFormData.name} onChange={e => setLicenseFormData({...licenseFormData, name: e.target.value})} className="bg-paper border-border" />
              <Input placeholder="Vendor" value={licenseFormData.vendor} onChange={e => setLicenseFormData({...licenseFormData, vendor: e.target.value})} className="bg-paper border-border" />
              <Input placeholder="License Key" value={licenseFormData.license_key} onChange={e => setLicenseFormData({...licenseFormData, license_key: e.target.value})} className="bg-paper border-border" />
              <Input placeholder="Total Seats" value={licenseFormData.seats_total} onChange={e => setLicenseFormData({...licenseFormData, seats_total: e.target.value})} className="bg-paper border-border" />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="ghost" onClick={() => setIsLicenseModalOpen(false)}>Cancel</Button>
              <Button className="bg-accent-500 text-black hover:bg-accent-600" onClick={handleLicenseSubmit}>Submit</Button>
            </div>
          </div>
        </div>
      )}

      {isBookModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md flex flex-col gap-4 shadow-xl">
            <h3 className="text-lg font-bold text-ink">{editingBookId ? 'Edit Book Req' : 'Add Book Req'}</h3>
            <div className="flex flex-col gap-3">
              <Input placeholder="Title" value={bookFormData.title} onChange={e => setBookFormData({...bookFormData, title: e.target.value})} className="bg-paper border-border" />
              <Input placeholder="Author" value={bookFormData.author} onChange={e => setBookFormData({...bookFormData, author: e.target.value})} className="bg-paper border-border" />
              <Input placeholder="Edition" value={bookFormData.edition} onChange={e => setBookFormData({...bookFormData, edition: e.target.value})} className="bg-paper border-border" />
              <Input placeholder="Status" value={bookFormData.status} onChange={e => setBookFormData({...bookFormData, status: e.target.value})} className="bg-paper border-border" />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="ghost" onClick={() => setIsBookModalOpen(false)}>Cancel</Button>
              <Button className="bg-accent-500 text-black hover:bg-accent-600" onClick={handleBookSubmit}>Submit</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
