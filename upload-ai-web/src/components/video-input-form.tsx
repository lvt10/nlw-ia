import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { FileVideo, Upload } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { getFFmpeg } from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import {api} from "@/lib/axios"

type status = 'waiting'|'converting'|'uploading'|'generating'|'success'
const statusMessage ={
  converting: 'convertendo...',
  generating: 'transcrevendo...',
  uploading: 'carregando...',
  success: 'sucesso',
}
interface VideoInputFormProps{
  onVideoUploaded:(id:string)=>void
}

export function VideoInputForm(props:VideoInputFormProps){
    const [videoFile, setVideoFile] = useState<File|null>(null)
    const[status, setStatus] = useState<status>('waiting')

    const promptInputRef = useRef<HTMLTextAreaElement>(null)

    function handleFileSelected(event: ChangeEvent<HTMLInputElement>){
      const {files} = event.currentTarget
      if(!files){
        return
      }
      const SelectedFile = files[0]
      setVideoFile(SelectedFile)

    }
    
    

    async function convertVideoToAudio(video:File){
      console.log('convert started')
      const ffmpeg = await getFFmpeg()
      await ffmpeg.writeFile('input.mp4', await fetchFile(video))
      //      ffmpeg.on('log', log=>{
      //        console.log(log)
      //      })
      ffmpeg.on('progress', progress =>{
        console.log('convert progress:'+ Math.round(progress.progress * 100))
      })
      await ffmpeg.exec([
        '-i',
        'input.mp4',
        '-map',
        '0:a',
        '-b:a',
        '20k',
        '-acodec',
        'libmp3lame',
        'output.mp3',
      ])
      const data = await ffmpeg.readFile('output.mp3')
      const audioFileBlob = new Blob([data], {type: 'audio/mpeg'})
      const audioFile = new File([audioFileBlob], 'audio.mp3', {
        type: 'audio/mpeg',
      })
      console.log('convert finish')
      return audioFile
    }

    async function handleUploadVideo(event: FormEvent<HTMLFormElement>){
      event.preventDefault()
      const prompt = promptInputRef.current?.value

      if(!videoFile){
        return
      }
      setStatus('converting')
      const audioFile = await convertVideoToAudio(videoFile)
      const data = new FormData()
      data.append('file', audioFile)

      setStatus('uploading')

      const response = await api.post('/videos',data)
      const videoId = response.data.video.id

      setStatus('generating')

      await api.post(`/videos/${videoId}/transcription`,{
        prompt,
      })
      setStatus('success')
      props.onVideoUploaded(videoId)
      
    }
    const previewURL = useMemo(()=> {
      if(!videoFile){
        return null
      }
      return URL.createObjectURL(videoFile)

    }, [videoFile])
    return (
        <form onSubmit = {handleUploadVideo} className='space-y-6'>
            <label htmlFor="video" className='relative border flex rounded-md aspect-video cursor-pointer border-dashed test-sm flex-col gap-2 items-center justify-center text-muted-foreground hover:bg-primary/10 '>
              {previewURL ?(
                <video src={previewURL} controls={false} className="pointer-events-none absolute inset-0"/>
              ):(
                <>
                <FileVideo className='w-4 h-4'/>
                selecione um video
                </>
              )}

            </label>
            <input type="file" id='video' accept='video/mp4' className='sr-only' onChange={handleFileSelected}/>
            <Separator/>
            <div className='space-y-2'>
              <Label htmlFor='transcription_prompt'>prompt de transcrição</Label>
              <Textarea 
              disabled= {status != 'waiting'}
              ref={(promptInputRef)}
              id='transcription_prompt'
              className='h-20 leading-relaxed'
              placeholder='inclua palavras-chave mencionadas no video separadas por virgula(,)'/>
            </div>
            <Button data-success={status=='success'} disabled= {status != 'waiting'}type='submit' className='w-full data-[success=true]:bg-emerald-400'>
              {status =='waiting' ?(
                <>
                carregar video
                <Upload className="w-4 h-4 ml-2"/>
                </>
              ): statusMessage[status]}
              <Upload className='w-4 h-4 nl-2'/>
            </Button>
        </form>
    )
}