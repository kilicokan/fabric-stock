"use client"

import React, { useState, useRef } from "react"
import { Stage, Layer, Line, Text, Image as KonvaImage } from "react-konva"
import Konva from "konva"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Minus } from "lucide-react"

interface Annotation {
  id: string
  x: number
  y: number
  text: string
  linePoints: number[]
}

interface ImageData {
  front: string | null
  back: string | null
}

export default function SewingInstruction() {
  const [modelInfo, setModelInfo] = useState({
    modelNo: "",
    modelName: "",
    fabricContent: "",
    washingInstruction: "",
    weightMeter: "",
    threadNote: "",
  })

  const [trackingData, setTrackingData] = useState([
    { process: "FASON", action: "TESLİM EDEN", name: "", quantity: "" },
    { process: "FASON", action: "TESLİM ALAN", name: "", quantity: "" },
    { process: "ÜTÜ", action: "TESLİM EDEN", name: "", quantity: "" },
    { process: "ÜTÜ", action: "TESLİM ALAN", name: "", quantity: "" },
  ])

  const [checklist, setChecklist] = useState<string[]>([
    "YAKA BİYESİNİN ESNEMEMESİ",
    "ADIM AYARLARI ACIK OLMAYACAK",
    "YIKAMA TALİMATI",
    "İPLİK TEMİZLEME",
    "SAĞ SOL KOL EŞİTLİĞİ",
  ])

  const [images, setImages] = useState<ImageData>({ front: null, back: null })
  const [annotations, setAnnotations] = useState<{ front: Annotation[]; back: Annotation[] }>({
    front: [],
    back: [],
  })
  const [currentView, setCurrentView] = useState<"front" | "back">("front")
  const [isDrawing, setIsDrawing] = useState(false)
  const [newAnnotation, setNewAnnotation] = useState<Partial<Annotation> | null>(null)

  const stageRef = useRef<Konva.Stage>(null)
  const imageRefs = useRef<{ front: Konva.Image | null; back: Konva.Image | null }>({ front: null, back: null })

  const handleImageUpload = (view: "front" | "back", event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImages(prev => ({ ...prev, [view]: e.target?.result as string }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing) return

    const stage = e.target.getStage()
    if (!stage) return

    const pointer = stage.getPointerPosition()
    if (!pointer) return

    if (!newAnnotation) {
      // Start drawing line
      setNewAnnotation({
        id: Date.now().toString(),
        x: pointer.x,
        y: pointer.y,
        text: "",
        linePoints: [pointer.x, pointer.y],
      })
    } else {
      // Finish line and add text
      const text = prompt("Açıklama girin:")
      if (text) {
        const updatedAnnotation: Annotation = {
          ...newAnnotation,
          text,
          linePoints: [...newAnnotation.linePoints!, pointer.x, pointer.y],
        } as Annotation

        setAnnotations(prev => ({
          ...prev,
          [currentView]: [...prev[currentView], updatedAnnotation],
        }))
      }
      setNewAnnotation(null)
    }
  }

  const addChecklistItem = () => {
    setChecklist(prev => [...prev, ""])
  }

  const updateChecklistItem = (index: number, value: string) => {
    setChecklist(prev => prev.map((item, i) => i === index ? value : item))
  }

  const removeChecklistItem = (index: number) => {
    setChecklist(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="max-w-[1400px] mx-auto bg-white shadow-lg">
      {/* Header with Logo */}
      <div className="border-b-2 border-gray-300 p-6 bg-gradient-to-r from-blue-50 to-white">
        <div className="flex items-center gap-4">
          <div className="w-48 h-16 bg-gray-200 flex items-center justify-center rounded">
            <span className="text-2xl font-bold text-blue-600">TURKUVAZ</span>
          </div>
          <div className="text-sm text-gray-600">giyim</div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-0 border-collapse">
        {/* Left Section - Model Info */}
        <div className="col-span-3 border-r border-gray-300">
          <div className="p-4 space-y-3">
            <EditableInfoRow
              label="MODEL NO"
              value={modelInfo.modelNo}
              onChange={(value) => setModelInfo(prev => ({ ...prev, modelNo: value }))}
            />
            <EditableInfoRow
              label="MODEL İSMİ"
              value={modelInfo.modelName}
              onChange={(value) => setModelInfo(prev => ({ ...prev, modelName: value }))}
            />
            <EditableInfoRow
              label="KUMAŞ İÇERİĞİ"
              value={modelInfo.fabricContent}
              onChange={(value) => setModelInfo(prev => ({ ...prev, fabricContent: value }))}
            />
            <EditableInfoRow
              label="YIKAMA TALİMATI"
              value={modelInfo.washingInstruction}
              onChange={(value) => setModelInfo(prev => ({ ...prev, washingInstruction: value }))}
            />
            <EditableInfoRow
              label="GRAMAJ & METRE"
              value={modelInfo.weightMeter}
              onChange={(value) => setModelInfo(prev => ({ ...prev, weightMeter: value }))}
            />
            <div className="pt-2">
              <Textarea
                placeholder="İplik notu..."
                value={modelInfo.threadNote}
                onChange={(e) => setModelInfo(prev => ({ ...prev, threadNote: e.target.value }))}
                className="text-sm font-semibold text-center border-t border-gray-200 resize-none"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Middle Section - Tracking Tables */}
        <div className="col-span-4 border-r border-gray-300">
          {/* NUMUNE Table */}
          <div className="border-b border-gray-300">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th colSpan={3} className="border border-gray-300 p-2 font-bold">
                    NUMUNE
                  </th>
                  <th className="border border-gray-300 p-2 font-bold">FASONA TESLİM EDİLEN ADET</th>
                </tr>
              </thead>
              <tbody>
                {trackingData.map((row, index) => (
                  <tr key={index}>
                    <td className="border border-gray-300 p-2 font-semibold">{row.process}</td>
                    <td className="border border-gray-300 p-2">{row.action}</td>
                    <td className="border border-gray-300 p-2">
                      <Input
                        value={row.name}
                        onChange={(e) => {
                          const updated = [...trackingData]
                          updated[index].name = e.target.value
                          setTrackingData(updated)
                        }}
                        className="text-xs h-6"
                      />
                    </td>
                    <td className="border border-gray-300 p-2">
                      <Input
                        value={row.quantity}
                        onChange={(e) => {
                          const updated = [...trackingData]
                          updated[index].quantity = e.target.value
                          setTrackingData(updated)
                        }}
                        className="text-xs h-6"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Control Checklist */}
          <div className="p-4">
            <div className="bg-gray-100 border border-gray-300 p-2 text-center font-bold text-sm mb-2">
              KONTROL EDİLECEKLER
            </div>
            <div className="space-y-1 text-xs">
              {checklist.map((item, index) => (
                <div key={index} className="flex items-center gap-2 border border-gray-300 p-1.5">
                  <div className="w-4 h-4 border border-gray-400 flex-shrink-0 mt-0.5"></div>
                  <Input
                    value={item}
                    onChange={(e) => updateChecklistItem(index, e.target.value)}
                    className="flex-1 text-xs h-6 border-none p-0"
                  />
                  <Button
                    onClick={() => removeChecklistItem(index)}
                    size="sm"
                    variant="ghost"
                    className="h-4 w-4 p-0"
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <Button onClick={addChecklistItem} size="sm" variant="outline" className="w-full mt-2">
                <Plus className="w-4 h-4 mr-1" />
                Ekle
              </Button>
            </div>
          </div>
        </div>

        {/* Right Section - Product Images with Instructions */}
        <div className="col-span-5">
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Front View */}
              <div className="relative">
                <div className="bg-gray-100 rounded-lg p-4 h-[500px] flex flex-col">
                  <div className="mb-2">
                    <label className="block text-sm font-medium mb-1">Ön Görünüm</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload("front", e)}
                      className="text-xs"
                    />
                  </div>
                  <div className="flex-1 relative">
                    <Stage
                      width={200}
                      height={400}
                      ref={stageRef}
                      onClick={handleStageClick}
                      className="border border-gray-300 rounded"
                    >
                      <Layer>
                        {images.front && (
                          <KonvaImage
                            image={new window.Image()}
                            x={0}
                            y={0}
                            width={200}
                            height={400}
                            ref={(ref) => {
                              if (ref && images.front) {
                                const img = new window.Image()
                                img.src = images.front
                                img.onload = () => {
                                  ref.image(img)
                                  ref.getLayer()?.batchDraw()
                                }
                              }
                            }}
                          />
                        )}
                        {annotations.front.map((annotation) => (
                          <React.Fragment key={annotation.id}>
                            <Line
                              points={annotation.linePoints}
                              stroke="red"
                              strokeWidth={2}
                            />
                            <Text
                              x={annotation.x}
                              y={annotation.y}
                              text={annotation.text}
                              fontSize={10}
                              fill="black"
                              backgroundFill="white"
                              padding={2}
                            />
                          </React.Fragment>
                        ))}
                      </Layer>
                    </Stage>
                  </div>
                  <Button
                    onClick={() => setCurrentView("front")}
                    variant={currentView === "front" ? "default" : "outline"}
                    size="sm"
                    className="mt-2"
                  >
                    Çizim Modu
                  </Button>
                </div>
              </div>

              {/* Back View */}
              <div className="relative">
                <div className="bg-gray-100 rounded-lg p-4 h-[500px] flex flex-col">
                  <div className="mb-2">
                    <label className="block text-sm font-medium mb-1">Arka Görünüm</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload("back", e)}
                      className="text-xs"
                    />
                  </div>
                  <div className="flex-1 relative">
                    <Stage
                      width={200}
                      height={400}
                      onClick={handleStageClick}
                      className="border border-gray-300 rounded"
                    >
                      <Layer>
                        {images.back && (
                          <KonvaImage
                            image={new window.Image()}
                            x={0}
                            y={0}
                            width={200}
                            height={400}
                            ref={(ref) => {
                              if (ref && images.back) {
                                const img = new window.Image()
                                img.src = images.back
                                img.onload = () => {
                                  ref.image(img)
                                  ref.getLayer()?.batchDraw()
                                }
                              }
                            }}
                          />
                        )}
                        {annotations.back.map((annotation) => (
                          <React.Fragment key={annotation.id}>
                            <Line
                              points={annotation.linePoints}
                              stroke="red"
                              strokeWidth={2}
                            />
                            <Text
                              x={annotation.x}
                              y={annotation.y}
                              text={annotation.text}
                              fontSize={10}
                              fill="black"
                              backgroundFill="white"
                              padding={2}
                            />
                          </React.Fragment>
                        ))}
                      </Layer>
                    </Stage>
                  </div>
                  <Button
                    onClick={() => setCurrentView("back")}
                    variant={currentView === "back" ? "default" : "outline"}
                    size="sm"
                    className="mt-2"
                  >
                    Çizim Modu
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <Button
                onClick={() => setIsDrawing(!isDrawing)}
                variant={isDrawing ? "outline" : "default"}
              >
                {isDrawing ? "Çizimi Durdur" : "Çizim Başlat"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditableInfoRow({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid grid-cols-5 gap-2 text-xs">
      <div className="col-span-2 font-semibold text-right pr-2">{label}</div>
      <div className="col-span-3">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="border-b border-gray-300 pb-1 border-l-0 border-r-0 border-t-0 rounded-none h-auto px-0"
        />
      </div>
    </div>
  )
}
