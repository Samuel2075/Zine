/**
 * Faz o upload de um arquivo para o Google Drive usando a API v3
 * @param {File} file - O arquivo de imagem selecionado
 * @param {string} accessToken - Token de acesso OAuth 2.0 obtido após o login do usuário
 * @param {string} [folderId] - ID da pasta do Drive onde o arquivo será salvo (opcional)
 */
export async function salvarCapaNoDrive(file, accessToken, folderId = null) {
    try {
        const metadata = {
            name: `capa_${Date.now()}_${file.name}`,
            mimeType: file.type
        };

        // Se uma pasta específica foi informada, define ela como pai
        if (folderId) {
            metadata.parents = [folderId];
        }

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        // Requisição multipart para a API do Google Drive
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
            body: form
        });

        if (!response.ok) {
            throw new Error(`Erro no upload para o Google Drive: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Retorna o link de visualização pública ou de download direto
        // Nota: Para imagens exibidas na tag <img>, o webContentLink ou um link direto costuma ser ideal.
        return data.webContentLink || data.webViewLink;

    } catch (error) {
        console.error("Erro ao enviar imagem para o Google Drive:", error);
        throw error;
    }
}