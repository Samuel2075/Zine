/**
 * Faz o upload de um arquivo para o Google Drive usando a API v3
 * @param {File} file - O arquivo de imagem selecionado
 * @param {string} accessToken - Token de acesso OAuth 2.0 temporário
 * @param {string} [folderId] - ID da pasta do Drive onde o arquivo será salvo (opcional)
 */
export async function salvarCapaNoDrive(file, accessToken, folderId = null) {
    try {
        const metadata = {
            name: `capa_${Date.now()}_${file.name}`,
            mimeType: file.type
        };

        // Se quiser salvar em uma pasta específica do seu Drive, informe o ID dela
        if (folderId) {
            metadata.parents = [folderId];
        }

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
            body: form
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Detalhes do erro do Google:", errorData);
            throw new Error(`Erro no upload para o Google Drive: ${response.statusText}`);
        }

        const data = await response.json();
        const fileId = data.id;

        // Concede permissão pública de leitura para que a tag <img> consiga exibir a imagem sem erro 403
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
            method: 'POST',
            headers: new Headers({
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            }),
            body: JSON.stringify({
                role: 'reader',
                type: 'anyone'
            })
        });

        // Retorna o link direto otimizado para exibição em tags <img>
        return `https://lh3.googleusercontent.com/d/${fileId}`;

    } catch (error) {
        console.error("Erro ao enviar imagem para o Google Drive:", error);
        throw error;
    }
}