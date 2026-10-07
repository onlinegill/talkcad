import { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { useLayoutStore, useRenderStore } from '../store';
import { FileExplorer } from './FileExplorer';
import { CodeEditor } from './CodeEditor';
import { Viewport } from './Viewport';
import { SpecsPanel } from './SpecsPanel';
import { ChatPanel } from './ChatPanel';
import { TitleBar } from './TitleBar';
import { PrintPanel } from './PrintPanel';
import { CreatePanel } from './CreatePanel';
import { ModifyPanel } from './ModifyPanel';
import { PartsPanel } from './PartsPanel';
import { StepPanel } from './StepPanel';

export function Layout() {
  const [printOpen, setPrintOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false);
  const [stepOpen, setStepOpen] = useState(false);
  const setRenderResult = useRenderStore((state) => state.setRenderResult);
  const setImportedModel = useRenderStore((state) => state.setImportedModel);
  const { viewMode, filesCollapsed, specsCollapsed, setViewMode, toggleFiles, toggleSpecs } =
    useLayoutStore();
  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            setViewMode('code');
            break;
          case '2':
            e.preventDefault();
            setViewMode('preview');
            break;
          case 'b':
            e.preventDefault();
            toggleFiles();
            break;
          case 'j':
            e.preventDefault();
            toggleSpecs();
            break;
        }
      }
    },
    [setViewMode, toggleFiles, toggleSpecs]
  );

  const importStl = useCallback(async () => {
    const file = await window.api.fs.openBinaryFile([
      { name: 'STL Models', extensions: ['stl'] },
    ]);
    if (!file) return;

    const stats = await window.api.openscad.parseStlStats(file.base64);
    setImportedModel(file.base64, 'stl', file.path);
    setRenderResult(file.base64, stats);
    setPrintOpen(false);
    setCreateOpen(false);
    setModifyOpen(false);
    setPartsOpen(false);
    setViewMode('preview');
  }, [setImportedModel, setRenderResult, setViewMode]);

  const import3mf = useCallback(async () => {
    const file = await window.api.fs.openBinaryFile([
      { name: '3MF Projects', extensions: ['3mf'] },
    ]);
    if (!file) return;

    setImportedModel(file.base64, '3mf', file.path);
    setCreateOpen(false);
    setModifyOpen(false);
    setPartsOpen(false);
    setPrintOpen(false);
    setViewMode('preview');
  }, [setImportedModel, setViewMode]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col h-screen bg-zinc-900 text-zinc-100">
      {/* Title Bar */}
      <TitleBar />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Files Sidebar */}
        <div
          className={clsx(
            'hidden md:block border-r border-zinc-700 transition-all duration-200 shrink-0',
            filesCollapsed ? 'w-10' : 'w-56'
          )}
        >
          <FileExplorer collapsed={filesCollapsed} onToggle={toggleFiles} />
        </div>

        {/* Center Panel */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center gap-1 px-2 py-1 border-b border-zinc-700 bg-zinc-800/50 overflow-x-auto whitespace-nowrap">
            <button
              onClick={() => { setPrintOpen(false); setCreateOpen(false); setModifyOpen(false); setPartsOpen(false); setStepOpen(false); setViewMode('code'); }}
              className={clsx(
                'px-3 py-1 text-sm rounded transition-colors',
                viewMode === 'code'
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
              )}
            >
              Code
            </button>
            <button
              onClick={() => { setPrintOpen(false); setCreateOpen(false); setModifyOpen(false); setPartsOpen(false); setStepOpen(false); setViewMode('preview'); }}
              className={clsx(
                'px-3 py-1 text-sm rounded transition-colors',
                viewMode === 'preview'
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
              )}
            >
              Preview
            </button>
            <button
              onClick={() => { setPrintOpen(false); setCreateOpen(false); setModifyOpen(false); setPartsOpen(false); setStepOpen(false); setViewMode('split'); }}
              className={clsx(
                'px-3 py-1 text-sm rounded transition-colors',
                !printOpen && viewMode === 'split'
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
              )}
            >
              Split
            </button>
            <button
              onClick={() => { setPrintOpen(false); setModifyOpen(false); setPartsOpen(false); setStepOpen(false); setCreateOpen(true); }}
              className={clsx(
                'px-3 py-1 text-sm rounded transition-colors',
                createOpen
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
              )}
            >
              Create
            </button>
            <button
              onClick={() => { setPrintOpen(false); setCreateOpen(false); setModifyOpen(false); setStepOpen(false); setPartsOpen(true); }}
              className={clsx(
                'px-3 py-1 text-sm rounded transition-colors',
                partsOpen
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
              )}
            >
              Parts
            </button>
            <button
              onClick={() => { setPrintOpen(false); setCreateOpen(false); setPartsOpen(false); setStepOpen(false); setModifyOpen(true); }}
              className={clsx(
                'px-3 py-1 text-sm rounded transition-colors',
                modifyOpen
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
              )}
            >
              Modify
            </button>
            <button
              onClick={() => { setPrintOpen(false); setCreateOpen(false); setModifyOpen(false); setPartsOpen(false); setStepOpen(true); }}
              className={clsx(
                'px-3 py-1 text-sm rounded transition-colors',
                stepOpen
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
              )}
            >
              STEP
            </button>
            <button
              onClick={() => { setCreateOpen(false); setModifyOpen(false); setPartsOpen(false); setStepOpen(false); setPrintOpen(true); }}
              className={clsx(
                'px-3 py-1 text-sm rounded transition-colors',
                printOpen
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
              )}
            >
              Print
            </button>
            <button
              onClick={importStl}
              className="px-3 py-1 text-sm rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors"
            >
              Import STL
            </button>
            <button
              onClick={import3mf}
              className="px-3 py-1 text-sm rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors"
            >
              Import 3MF
            </button>
          </div>

          {/* Code / Preview Area */}
          <div className="flex-1 overflow-hidden">
            {stepOpen && <StepPanel onPreview={() => { setStepOpen(false); setViewMode('preview'); }} />}
            {!stepOpen && createOpen && <CreatePanel onCreated={() => { setCreateOpen(false); setModifyOpen(false); setPartsOpen(false); setPrintOpen(false); setViewMode('split'); }} />}
            {!stepOpen && !createOpen && partsOpen && <PartsPanel onAssemble={() => { setPartsOpen(false); setStepOpen(false); setViewMode('split'); }} />}
            {!stepOpen && !createOpen && !partsOpen && modifyOpen && <ModifyPanel onApplied={() => { setModifyOpen(false); setViewMode('split'); }} />}
            {!stepOpen && !createOpen && !partsOpen && !modifyOpen && printOpen && <PrintPanel />}
            {!stepOpen && !createOpen && !partsOpen && !modifyOpen && !printOpen && viewMode === 'code' && <CodeEditor />}
            {!stepOpen && !createOpen && !partsOpen && !modifyOpen && !printOpen && viewMode === 'preview' && <Viewport />}
            {!stepOpen && !createOpen && !partsOpen && !modifyOpen && !printOpen && viewMode === 'split' && (
              <div className="flex flex-col md:flex-row h-full">
                <div className="h-1/2 md:h-full w-full md:w-1/2 border-b md:border-b-0 md:border-r border-zinc-700">
                  <CodeEditor />
                </div>
                <div className="h-1/2 md:h-full w-full md:w-1/2">
                  <Viewport />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Specs Sidebar */}
        <div
          className={clsx(
            'hidden lg:block border-l border-zinc-700 transition-all duration-200 shrink-0',
            specsCollapsed ? 'w-10' : 'w-56'
          )}
        >
          <SpecsPanel collapsed={specsCollapsed} onToggle={toggleSpecs} />
        </div>
      </div>

      {/* Chat Panel */}
      <ChatPanel />
    </div>
  );
}
