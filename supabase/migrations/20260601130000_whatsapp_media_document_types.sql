-- Ampliar los tipos de archivo admitidos en el bucket privado `whatsapp-media`
-- para poder enviar a las familias todo tipo de documentos dentro de la ventana
-- de 24h (PDF, Word, Excel, PowerPoint, texto…), no solo PDF/Word.
--
-- El bucket valida `allowed_mime_types` tanto en subidas por servidor como en
-- subidas con signed upload URL desde el navegador, así que esta lista debe
-- contener todos los tipos que la UI permite adjuntar. Se mantiene el límite de
-- 100 MB ya existente. Solo se incluyen tipos que WhatsApp Cloud API entrega.

update storage.buckets
set allowed_mime_types = array[
  -- Imágenes
  'image/jpeg',
  'image/png',
  'image/webp',
  -- Vídeo
  'video/mp4',
  'video/quicktime',
  'video/3gpp',
  -- Audio
  'audio/aac',
  'audio/amr',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  -- Documentos
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]
where id = 'whatsapp-media';
