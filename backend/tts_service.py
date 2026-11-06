import sys
import asyncio
import edge_tts

async def generate_audio(text, voice, output_path):
    print("STATUS:Starting synthesis...", flush=True)
    # Using dynamic voice and standard neural speed
    communicate = edge_tts.Communicate(text, voice, rate="-5%")
    await communicate.save(output_path)
    print("STATUS:Completed", flush=True)

if __name__ == "__main__":
    if len(sys.argv) < 4:
        sys.exit(1)

    text_input = sys.argv[1]
    voice_choice = sys.argv[2]
    out_file = sys.argv[3]

    asyncio.run(generate_audio(text_input, voice_choice, out_file))
