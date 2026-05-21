export type UploadResult = {
  path: string
  signedUrl: string
}

export async function uploadCheckInPhoto(file: File, eventId: string): Promise<UploadResult> {
  const form = new FormData()
  form.append("file", file)
  form.append("eventId", eventId)

  const res = await fetch("/api/upload/checkin-photo", {
    method: "POST",
    body: form,
  })

  if (!res.ok) {
    const messages: Record<number, string> = {
      400: "Datos de carga inválidos. Intenta de nuevo.",
      401: "No autorizado. Inicia sesión e intenta de nuevo.",
      413: "La imagen es demasiado grande. Máximo 10MB.",
      415: "Formato de imagen no soportado. Usa JPEG, PNG o WebP.",
      502: "Error al guardar la foto. Intenta de nuevo en unos momentos.",
    }
    throw new Error(messages[res.status] ?? "No se pudo subir la foto. Intenta de nuevo.")
  }

  const { key } = (await res.json()) as { key: string }
  return { path: key, signedUrl: `/api/files/${key}` }
}
