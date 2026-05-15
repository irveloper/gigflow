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
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `Upload failed: ${res.status}`)
  }

  const { url } = (await res.json()) as { url: string }
  const path = new URL(url).pathname.slice(1) // strip leading /
  return { path, signedUrl: url }
}
