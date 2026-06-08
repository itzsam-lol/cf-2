import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const isHighValue = formData.get('isHighValue') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await new Promise<{secure_url: string; public_id: string}>((resolve, reject) => {
      const transformations: Record<string, unknown>[] = [
        { quality: 'auto', fetch_format: 'auto' }
      ];
      
      if (isHighValue) {
        transformations.push({ effect: 'blur:1000' });
      }

      cloudinary.uploader.upload_stream(
        {
          folder: 'campusfind',
          transformation: transformations,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result as {secure_url: string; public_id: string});
        }
      ).end(buffer);
    });

    // If high value, also get the original (unblurred) URL for admin view
    let originalUrl = result.secure_url;
    if (isHighValue) {
      originalUrl = cloudinary.url(result.public_id, {
        quality: 'auto',
        fetch_format: 'auto',
        secure: true,
      });
    }

    return NextResponse.json({
      url: result.secure_url,
      originalUrl,
      publicId: result.public_id,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
