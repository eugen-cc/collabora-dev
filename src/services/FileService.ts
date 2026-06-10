export interface Document {
	id: string;
	name: string;
	size: number;
	updatedAt: string;
}

const API_BASE = 'http://localhost:5001/api';

export const FileService = {
	async getFiles(): Promise<Document[]> {
		const res = await fetch(`${API_BASE}/files`);
		if (!res.ok) {
			throw new Error('Failed to fetch files');
		}
		return res.json();
	},

	async createFile(name: string): Promise<Document> {
		const res = await fetch(`${API_BASE}/files`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name }),
		});
		if (!res.ok) {
			const data = await res.json();
			throw new Error(data.error || 'Fehler beim Erstellen des Dokuments');
		}
		return res.json();
	},

	async deleteFile(id: string): Promise<void> {
		const res = await fetch(`${API_BASE}/files/${id}`, {
			method: 'DELETE',
		});
		if (!res.ok) {
			const data = await res.json();
			throw new Error(data.error || 'Fehler beim Löschen des Dokuments');
		}
	},
};
