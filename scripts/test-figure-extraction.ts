// Quick test script for figure extraction
// Run with: npx tsx scripts/test-figure-extraction.ts

import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const PDF_PATH = path.join(process.cwd(), 'public/uploads/pdfs/1767545414971-sat-practice-test-1-digital_PalmDrive_Academy.pdf');
const OUTPUT_DIR = path.join(process.cwd(), 'public/uploads/figures');

async function testFigureExtraction() {
    console.log('🧪 Testing figure extraction...');
    console.log(`📄 PDF: ${PDF_PATH}`);

    // Check if PDF exists
    try {
        await fs.access(PDF_PATH);
        console.log('✅ PDF file exists');
    } catch {
        console.error('❌ PDF file not found');
        return;
    }

    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // Test page 7 (question 14 has a figure)
    const targetPage = 7;

    console.log(`\n📄 Rendering page ${targetPage} with pdf-to-img...`);

    try {
        // Use pdf-to-img which handles the canvas setup correctly
        const { pdf } = await import('pdf-to-img');

        const pdfBuffer = await fs.readFile(PDF_PATH);
        console.log('   Loading PDF document...');

        const document = await pdf(pdfBuffer, { scale: 2.0 });

        let currentPage = 0;
        let pageBuffer: Buffer | null = null;

        console.log('   Iterating through pages...');
        for await (const image of document) {
            currentPage++;
            console.log(`   Page ${currentPage}...`);
            if (currentPage === targetPage) {
                pageBuffer = Buffer.from(image);
                console.log(`   ✅ Found page ${targetPage} (${pageBuffer.length} bytes)`);
                break;
            }
        }

        if (!pageBuffer) {
            console.error(`   ❌ Page ${targetPage} not found`);
            return;
        }

        // Save full page for inspection
        const fullPagePath = path.join(OUTPUT_DIR, `test-page-${targetPage}-full.png`);
        await fs.writeFile(fullPagePath, pageBuffer);
        console.log(`   💾 Saved full page: ${fullPagePath}`);

        // Test cropping a region (simulate figure extraction)
        const metadata = await sharp(pageBuffer).metadata();
        console.log(`   Image dimensions: ${metadata.width}x${metadata.height}`);

        // Example bounding box (normalized 0-1000): [ymin, xmin, ymax, xmax]
        const testBbox = [200, 500, 600, 900]; // Middle-right region
        const [ymin, xmin, ymax, xmax] = testBbox;

        const imageWidth = metadata.width || 1;
        const imageHeight = metadata.height || 1;

        const cropX = Math.round((xmin / 1000) * imageWidth);
        const cropY = Math.round((ymin / 1000) * imageHeight);
        const cropWidth = Math.round(((xmax - xmin) / 1000) * imageWidth);
        const cropHeight = Math.round(((ymax - ymin) / 1000) * imageHeight);

        console.log(`   Crop region: x=${cropX}, y=${cropY}, w=${cropWidth}, h=${cropHeight}`);

        const croppedBuffer = await sharp(pageBuffer)
            .extract({
                left: cropX,
                top: cropY,
                width: cropWidth,
                height: cropHeight
            })
            .png()
            .toBuffer();

        console.log(`   ✅ Cropped image: ${croppedBuffer.length} bytes`);

        // Save cropped image
        const croppedPath = path.join(OUTPUT_DIR, `test-page-${targetPage}-cropped.png`);
        await fs.writeFile(croppedPath, croppedBuffer);
        console.log(`   💾 Saved cropped: ${croppedPath}`);

        // Test base64 encoding
        const base64Data = croppedBuffer.toString('base64');
        console.log(`   ✅ Base64 length: ${base64Data.length} chars`);
        console.log(`   First 100 chars: ${base64Data.substring(0, 100)}...`);

        console.log('\n✅ Figure extraction test PASSED!');

    } catch (error) {
        console.error('\n❌ Error during test:', error);
    }
}

testFigureExtraction();
