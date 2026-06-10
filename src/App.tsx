import { useEffect, useState } from 'react';
import { KolButton } from '@public-ui/react';
import { CollaboraEditor } from './components/CollaboraEditor';
import { FileService, Document } from './services/FileService';
import './App.css';

function App() {
	// Configuration state (persisted in LocalStorage)
	const [collaboraUrl, setCollaboraUrl] = useState(() => {
		return localStorage.getItem('cool_url') || 'http://localhost:9980';
	});
	const [wopiHostUrl, setWopiHostUrl] = useState(() => {
		return localStorage.getItem('wopi_host_url') || 'http://host.docker.internal:5001';
	});

	// App state
	const [documents, setDocuments] = useState<Document[]>([]);
	const [loading, setLoading] = useState(true);
	const [backendError, setBackendError] = useState(false);
	const [newDocName, setNewDocName] = useState('');
	const [activeFileId, setActiveFileId] = useState<string | null>(() => {
		const params = new URLSearchParams(window.location.search);
		return params.get('fileId');
	});
	const [isCreating, setIsCreating] = useState(false);
	const [copiedCommand, setCopiedCommand] = useState(false);
	const [activeTab, setActiveTab] = useState<'docker' | 'wopi' | 'troubleshoot'>('docker');

	useEffect(() => {
		localStorage.setItem('cool_url', collaboraUrl);
	}, [collaboraUrl]);

	useEffect(() => {
		localStorage.setItem('wopi_host_url', wopiHostUrl);
	}, [wopiHostUrl]);

	const loadDocuments = async () => {
		setLoading(true);
		setBackendError(false);
		try {
			const data = await FileService.getFiles();
			setDocuments(data);
		} catch (err) {
			console.error('Error fetching documents from backend:', err);
			setBackendError(true);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadDocuments();
	}, []);

	const handleCreateDoc = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newDocName.trim()) return;

		setIsCreating(true);
		try {
			const newDoc = await FileService.createFile(newDocName);
			setDocuments((prev) => [newDoc, ...prev]);
			setNewDocName('');
		} catch (err: any) {
			alert(err.message || 'Backend-Server antwortet nicht. Läuft "npm run backend"?');
		} finally {
			setIsCreating(false);
		}
	};

	const handleDeleteDoc = async (id: string, e: React.MouseEvent) => {
		e.stopPropagation();
		if (!confirm(`Möchtest du das Dokument "${id.replace(/_/g, ' ')}" wirklich löschen?`)) {
			return;
		}

		try {
			await FileService.deleteFile(id);
			setDocuments((prev) => prev.filter((doc) => doc.id !== id));
			if (activeFileId === id) {
				setActiveFileId(null);
			}
		} catch (err) {
			alert('Fehler beim Löschen des Dokuments oder Backend antwortet nicht.');
		}
	};

	const copyDockerCommand = () => {
		const cmd = `docker run -t -d -p 9980:9980 -e "extra_params=--o:ssl.enable=false --o:ssl.termination=false" --cap-add MKNOD --name collabora-online collabora/code`;
		navigator.clipboard.writeText(cmd);
		setCopiedCommand(true);
		setTimeout(() => setCopiedCommand(false), 2000);
	};

	const formatSize = (bytes: number) => {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	};

	const formatDate = (dateStr: string) => {
		return new Date(dateStr).toLocaleString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	// Render the full screen editor if a file is active
	if (activeFileId) {
		return (
			<div className="fixed inset-0 w-full h-full z-50">
				<CollaboraEditor
					fileId={activeFileId}
					token="secure_dev_token_123"
					collaboraUrl={collaboraUrl}
					wopiHostUrl={wopiHostUrl}
					onClose={() => {
						if (window.opener) {
							window.close();
						} else {
							window.location.search = '';
						}
					}}
				/>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#0e0e11] text-gray-100 font-sans p-6 md:p-10 select-none">
			{/* Dashboard Container */}
			<div className="max-w-6xl mx-auto space-y-8">
				{/* Top Header Card */}
				<header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-8 rounded-2xl bg-gradient-to-r from-[#1b1c24] to-[#121318] border border-[#272835] shadow-xl relative overflow-hidden">
					<div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
					<div className="absolute left-1/3 bottom-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

					<div className="space-y-2 relative z-10">
						<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
							<span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
							WOPI Integration Active
						</div>
						<h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
							Collabora Online <span className="text-emerald-400">Workspace</span>
						</h1>
						<p className="text-sm text-gray-400 max-w-xl">
							Verwalte und bearbeite Word-Dokumente (.docx) in Echtzeit über die offizielle Collabora Online Suite und das standardisierte WOPI-Protokoll.
						</p>
					</div>

					<div className="flex gap-3 relative z-10">
						<KolButton
							_label="Aktualisieren"
							_variant="secondary"
							_icons="codicon codicon-refresh"
							_on={{
								onClick: loadDocuments,
							}}
						/>
					</div>
				</header>

				{/* Warning Banner if backend fails */}
				{backendError && (
					<div className="flex items-start gap-4 p-5 rounded-xl bg-red-950/40 border border-red-900/40 text-red-200">
						<span className="codicon codicon-warning text-2xl text-red-400 mt-0.5"></span>
						<div className="space-y-1">
							<h4 className="font-bold text-white text-base">Backend-Server nicht erreichbar</h4>
							<p className="text-sm text-red-300">
								Der Node.js/Express WOPI-Server läuft zurzeit nicht auf Port 5001. Bitte führe folgenden Befehl in einem neuen Terminal aus:
							</p>
							<code className="block bg-black/40 px-3 py-2 rounded text-xs font-mono text-rose-300 mt-2 border border-red-950 select-text">
								npm run backend
							</code>
						</div>
					</div>
				)}

				{/* Main Content Grid */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
					{/* Left 2 Columns: File List & Creation */}
					<div className="lg:col-span-2 space-y-6">
						{/* Document Creation Card */}
						<div className="p-6 rounded-xl bg-[#14151a] border border-[#23242e] shadow-md">
							<h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
								<span className="codicon codicon-plus text-emerald-400"></span>
								Neues Dokument erstellen
							</h3>
							<form onSubmit={handleCreateDoc} className="flex gap-4">
								<input
									type="text"
									placeholder="z.B. Projektbericht_Q2"
									value={newDocName}
									onChange={(e) => setNewDocName(e.target.value)}
									disabled={backendError || isCreating}
									className="flex-1 px-4 py-2 bg-[#0e0f12] border border-[#2a2b38] rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
								/>
								<KolButton
									_label={isCreating ? 'Erstelle...' : 'Erstellen'}
									_variant="primary"
									_icons="codicon codicon-plus"
									_on={{
										onClick: () => {},
									}}
								/>
							</form>
						</div>

						{/* Document List */}
						<div className="space-y-4">
							<div className="flex items-center justify-between px-2">
								<h2 className="text-lg font-bold text-white flex items-center gap-2">
									<span className="codicon codicon-file-word text-indigo-400"></span>
									Deine Dokumente
								</h2>
								<span className="text-xs text-gray-500 font-medium">{documents.length} Dokumente geladen</span>
							</div>

							{loading ? (
								<div className="p-12 text-center text-gray-500 bg-[#14151a]/50 rounded-xl border border-[#23242e]">
									<span className="codicon codicon-loading animate-spin text-3xl text-emerald-400 mb-2"></span>
									<p className="text-sm">Dokumente werden geladen...</p>
								</div>
							) : documents.length === 0 ? (
								<div className="p-16 text-center text-gray-500 bg-[#14151a]/40 rounded-xl border border-[#23242e] border-dashed">
									<span className="codicon codicon-folder-opened text-4xl text-gray-600 mb-3 block"></span>
									<p className="text-sm font-semibold text-gray-400">Keine Dokumente gefunden</p>
									<p className="text-xs text-gray-600 mt-1">Erstelle oben ein neues Dokument, um zu starten.</p>
								</div>
							) : (
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									{documents.map((doc) => (
										<div
											key={doc.id}
											onClick={() => window.open('?fileId=' + encodeURIComponent(doc.id), '_blank', 'width=1200,height=800,resizable=yes,scrollbars=yes')}
											className="group p-5 rounded-xl bg-[#14151a] hover:bg-[#1b1c24] border border-[#23242e] hover:border-emerald-500/50 shadow-sm hover:shadow-emerald-500/5 transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[140px]"
										>
											<div className="flex justify-between items-start">
												<div className="flex items-start gap-3">
													<div className="p-2 rounded bg-indigo-500/10 text-indigo-400">
														<span className="codicon codicon-file-word text-xl block"></span>
													</div>
													<div>
														<h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">{doc.name}.docx</h4>
														<p className="text-xs text-gray-400 mt-1">Größe: {formatSize(doc.size)}</p>
													</div>
												</div>

												<button
													onClick={(e) => handleDeleteDoc(doc.id, e)}
													className="p-1.5 rounded hover:bg-red-950/40 text-gray-500 hover:text-red-400 transition-colors"
													title="Dokument löschen"
												>
													<span className="codicon codicon-trash text-sm block"></span>
												</button>
											</div>

											<div className="flex items-center justify-between mt-4 pt-3 border-t border-[#23242e] text-[11px] text-gray-500">
												<span>Modifiziert: {formatDate(doc.updatedAt)}</span>
												<span className="text-emerald-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
													Öffnen
													<span className="codicon codicon-chevron-right text-[10px]"></span>
												</span>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</div>

					{/* Right Column: Connection Settings & Docker Guide */}
					<div className="space-y-6">
						{/* Settings Card */}
						<div className="p-6 rounded-xl bg-[#14151a] border border-[#23242e] shadow-md space-y-4">
							<h3 className="text-base font-bold text-white flex items-center gap-2">
								<span className="codicon codicon-settings text-indigo-400"></span>
								Verbindungs-Einstellungen
							</h3>

							<div className="space-y-3 text-xs">
								<div className="space-y-1">
									<label htmlFor="collabora-url-input" className="text-gray-400 font-semibold">
										Collabora Online URL (CODE)
									</label>
									<input
										id="collabora-url-input"
										type="text"
										value={collaboraUrl}
										onChange={(e) => setCollaboraUrl(e.target.value)}
										className="w-full px-3 py-2 bg-[#0e0f12] border border-[#2a2b38] rounded text-gray-200 focus:outline-none focus:border-indigo-500"
									/>
									<p className="text-[10px] text-gray-500">Der Endpunkt deiner Docker-Instanz.</p>
								</div>

								<div className="space-y-1">
									<label htmlFor="wopi-host-url-input" className="text-gray-400 font-semibold">
										WOPI Host URL (Backend)
									</label>
									<input
										id="wopi-host-url-input"
										type="text"
										value={wopiHostUrl}
										onChange={(e) => setWopiHostUrl(e.target.value)}
										className="w-full px-3 py-2 bg-[#0e0f12] border border-[#2a2b38] rounded text-gray-200 focus:outline-none focus:border-indigo-500"
									/>
									<p className="text-[10px] text-gray-500">
										Wie Docker den Node.js Host auflöst. Standard ist <code>http://host.docker.internal:5001</code>.
									</p>
								</div>
							</div>
						</div>

						{/* Integration Guide Tab System */}
						<div className="rounded-xl bg-[#14151a] border border-[#23242e] shadow-md overflow-hidden flex flex-col">
							{/* Tab Bar */}
							<div className="flex border-b border-[#23242e] bg-[#1a1b22]">
								<button
									onClick={() => setActiveTab('docker')}
									className={`flex-1 py-3 text-xs font-bold transition-colors border-b-2 ${
										activeTab === 'docker' ? 'text-emerald-400 border-emerald-400 bg-[#14151a]' : 'text-gray-400 border-transparent hover:text-white'
									}`}
								>
									Docker Setup
								</button>
								<button
									onClick={() => setActiveTab('wopi')}
									className={`flex-1 py-3 text-xs font-bold transition-colors border-b-2 ${
										activeTab === 'wopi' ? 'text-emerald-400 border-emerald-400 bg-[#14151a]' : 'text-gray-400 border-transparent hover:text-white'
									}`}
								>
									WOPI Prinzip
								</button>
								<button
									onClick={() => setActiveTab('troubleshoot')}
									className={`flex-1 py-3 text-xs font-bold transition-colors border-b-2 ${
										activeTab === 'troubleshoot' ? 'text-emerald-400 border-emerald-400 bg-[#14151a]' : 'text-gray-400 border-transparent hover:text-white'
									}`}
								>
									Troubleshoot
								</button>
							</div>

							{/* Tab Contents */}
							<div className="p-6 text-sm text-gray-300 space-y-4">
								{activeTab === 'docker' && (
									<div className="space-y-3">
										<p className="text-xs text-gray-400">Starte Collabora CODE lokal auf deinem Computer via Docker:</p>
										<div className="relative group/cmd">
											<pre className="bg-[#0e0f12] p-3 rounded-lg text-[10px] font-mono text-zinc-300 border border-[#2a2b38] overflow-x-auto whitespace-pre-wrap select-text pr-10">
												docker run -t -d -p 9980:9980 -e "extra_params=--o:ssl.enable=false --o:ssl.termination=false" --cap-add MKNOD --name collabora-online
												collabora/code
											</pre>
											<button
												onClick={copyDockerCommand}
												className="absolute top-2 right-2 p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-gray-400 hover:text-white transition-colors"
												title="Befehl kopieren"
											>
												<span className={`codicon ${copiedCommand ? 'codicon-pass text-emerald-400' : 'codicon-copy'} text-sm block`}></span>
											</button>
										</div>
										<ul className="text-xs text-gray-400 list-disc pl-4 space-y-1">
											<li>Deaktiviert SSL für bequemes lokales HTTP-Development.</li>
											<li>Stellt Port 9980 bereit.</li>
											<li>Läuft vollständig offline und autark.</li>
										</ul>
									</div>
								)}

								{activeTab === 'wopi' && (
									<div className="space-y-3 text-xs text-gray-400 leading-relaxed">
										<p>WOPI (Web Application Open Platform Interface) definiert, wie das Dokument zwischen App und Editor fließt:</p>
										<div className="space-y-2 border-l-2 border-indigo-500/40 pl-3">
											<p>
												<strong>1. Handshake:</strong> React lädt das Collabora-IFrame mit dem <code>WOPISrc</code> Parameter, der auf unseren Server zeigt.
											</p>
											<p>
												<strong>2. CheckFileInfo:</strong> Collabora holt Metadaten (Größe, Lese-/Schreibrechte, Benutzername) ab.
											</p>
											<p>
												<strong>3. GetFile:</strong> Collabora lädt die binären Bytes des Dokuments zur Bearbeitung herunter.
											</p>
											<p>
												<strong>4. PutFile:</strong> Beim Speichern postet Collabora das aktualisierte Dokument binär an unseren Server zurück.
											</p>
										</div>
									</div>
								)}

								{activeTab === 'troubleshoot' && (
									<div className="space-y-3 text-xs text-gray-400">
										<div className="space-y-1.5">
											<p className="font-bold text-gray-200">Wrong or missing WOPISrc</p>
											<p>
												Collabora kann den Node-Server nicht erreichen. Stelle sicher, dass die WOPI Host URL (z.B. host.docker.internal) korrekt aus dem
												Container auflösbar ist.
											</p>
										</div>
										<div className="space-y-1.5 pt-2 border-t border-[#23242e]">
											<p className="font-bold text-gray-200">IFrame lädt nicht / Blank</p>
											<p>
												Überprüfe in den Docker Logs (<code>docker logs -f collabora-online</code>), ob Collabora ohne Fehler gestartet ist und auf Port 9980
												lauscht.
											</p>
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default App;
