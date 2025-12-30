"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Line } from "react-chartjs-2"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  type Chart,
  type ChartEvent,
  type Plugin,
} from "chart.js"
import annotationPlugin from "chartjs-plugin-annotation"
import { Activity, Target, TrendingDown, TrendingUp, Calendar, Info, Download } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toPng } from "html-to-image"

// Custom crosshair plugin with axis labels
const crosshairPlugin: Plugin<"line"> = {
  id: "customCrosshair",
  afterDraw: (chart: Chart<"line">) => {
    const tooltip = chart.tooltip
    if (!tooltip || !tooltip.opacity || tooltip.dataPoints === undefined || tooltip.dataPoints.length === 0) {
      return
    }

    const ctx = chart.ctx
    const chartArea = chart.chartArea
    const dataPoint = tooltip.dataPoints[0]
    const x = dataPoint.element.x
    const y = dataPoint.element.y

    ctx.save()
    ctx.setLineDash([5, 5])
    ctx.lineWidth = 1
    ctx.strokeStyle = "#6b7280"

    // Vertical line from point to x-axis
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x, chartArea.bottom)
    ctx.stroke()

    // Horizontal line from point to left y-axis (weight)
    ctx.beginPath()
    ctx.moveTo(chartArea.left, y)
    ctx.lineTo(x, y)
    ctx.stroke()

    // Get BMI value and draw horizontal line to right y-axis
    if (tooltip.dataPoints.length > 1) {
      const bmiPoint = tooltip.dataPoints[1]
      const bmiY = bmiPoint.element.y
      ctx.beginPath()
      ctx.moveTo(x, bmiY)
      ctx.lineTo(chartArea.right, bmiY)
      ctx.stroke()

      // Draw BMI axis label
      const bmiValue = bmiPoint.parsed.y
      ctx.setLineDash([])
      ctx.fillStyle = "rgb(168, 85, 247)"
      ctx.font = "bold 11px sans-serif"
      ctx.textAlign = "left"
      ctx.fillText(bmiValue.toFixed(1), chartArea.right + 5, bmiY + 4)
    }

    // Draw weight axis label
    const weightValue = dataPoint.parsed.y
    ctx.setLineDash([])
    ctx.fillStyle = "rgb(99, 102, 241)"
    ctx.font = "bold 11px sans-serif"
    ctx.textAlign = "right"
    ctx.fillText(weightValue.toFixed(1), chartArea.left - 5, y + 4)

    // Draw x-axis label
    const xLabel = dataPoint.label
    ctx.fillStyle = "#374151"
    ctx.font = "bold 11px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(xLabel, x, chartArea.bottom + 15)

    ctx.restore()
  },
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin,
  crosshairPlugin
)

type WeightUnit = "kg" | "lbs"
type HeightUnit = "cm" | "ft"
type ViewMode = "daily" | "weekly" | "monthly"

interface ForecastData {
  period: number
  week?: number
  day?: number
  monthNum?: number
  weight: number
  bmi: number
  date: string
  month: string
  fullDate: Date
}

export default function WeightTracker() {
  const [heightFeet, setHeightFeet] = useState("")
  const [heightInches, setHeightInches] = useState("")
  const [heightCm, setHeightCm] = useState("")
  const [heightUnit, setHeightUnit] = useState<HeightUnit>("ft")
  const [currentWeight, setCurrentWeight] = useState("")
  const [goalWeight, setGoalWeight] = useState("")
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kg")
  const [customWeeklyChange, setCustomWeeklyChange] = useState("")
  const [forecast, setForecast] = useState<ForecastData[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>("weekly")
  const [recommendedWeight, setRecommendedWeight] = useState<{ min: number; max: number } | null>(null)
  const [goalBMI, setGoalBMI] = useState<number | null>(null)
  const [stats, setStats] = useState<{
    weeklyChange: number
    totalWeeks: number
    currentBMI: number
    goalBMI: number
    isWeightLoss: boolean
    safeWeeklyMin: number
    safeWeeklyMax: number
  } | null>(null)

  const tableRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const height = getHeightValue()
    const current = Number.parseFloat(currentWeight)

    if (height > 0 && current > 0) {
      calculateRecommendedWeight(height)
    } else {
      setRecommendedWeight(null)
    }
  }, [heightFeet, heightInches, heightCm, heightUnit, currentWeight, weightUnit])

  useEffect(() => {
    const height = getHeightValue()
    const goal = Number.parseFloat(goalWeight)

    if (height > 0 && goal > 0) {
      const bmi = calculateBMI(goal, height)
      setGoalBMI(Number.parseFloat(bmi.toFixed(1)))
    } else {
      setGoalBMI(null)
    }
  }, [heightFeet, heightInches, heightCm, heightUnit, goalWeight, weightUnit])

  const getHeightValue = (): number => {
    if (heightUnit === "ft") {
      const feet = Number.parseFloat(heightFeet) || 0
      const inches = Number.parseFloat(heightInches) || 0
      return feet + inches / 12
    }
    return Number.parseFloat(heightCm) || 0
  }

  const calculateRecommendedWeight = (height: number) => {
    const heightM = heightUnit === "cm" ? height / 100 : height * 0.3048

    const minWeightKg = 18.5 * (heightM * heightM)
    const maxWeightKg = 24.9 * (heightM * heightM)

    if (weightUnit === "lbs") {
      setRecommendedWeight({
        min: Number.parseFloat((minWeightKg * 2.20462).toFixed(1)),
        max: Number.parseFloat((maxWeightKg * 2.20462).toFixed(1)),
      })
    } else {
      setRecommendedWeight({
        min: Number.parseFloat(minWeightKg.toFixed(1)),
        max: Number.parseFloat(maxWeightKg.toFixed(1)),
      })
    }
  }

  const calculateBMI = (weight: number, height: number): number => {
    const weightKg = weightUnit === "lbs" ? weight * 0.453592 : weight
    const heightM = heightUnit === "cm" ? height / 100 : height * 0.3048

    return weightKg / (heightM * heightM)
  }

  const generateForecast = () => {
    const height = getHeightValue()
    const current = Number.parseFloat(currentWeight)
    const goal = Number.parseFloat(goalWeight)

    if (!height || !current || !goal || height <= 0 || current <= 0 || goal <= 0) {
      alert("Please enter valid values for all fields")
      return
    }

    if (current === goal) {
      alert("Current weight and goal weight are the same")
      return
    }

    const isWeightLoss = current > goal
    const totalChange = Math.abs(goal - current)

    const safeWeeklyMin = isWeightLoss ? (weightUnit === "kg" ? 0.5 : 1.0) : weightUnit === "kg" ? 0.25 : 0.5

    const safeWeeklyMax = isWeightLoss ? (weightUnit === "kg" ? 1.0 : 2.0) : weightUnit === "kg" ? 0.5 : 1.0

    let weeklyChange: number
    if (customWeeklyChange && Number.parseFloat(customWeeklyChange) > 0) {
      weeklyChange = Number.parseFloat(customWeeklyChange)
    } else {
      weeklyChange = (safeWeeklyMin + safeWeeklyMax) / 2
    }

    const signedWeeklyChange = isWeightLoss ? -weeklyChange : weeklyChange
    const totalWeeks = Math.ceil(totalChange / weeklyChange)

    const forecastData: ForecastData[] = []
    const today = new Date()

    for (let week = 0; week <= totalWeeks; week++) {
      const projectedWeight = current + signedWeeklyChange * week
      const finalWeight = isWeightLoss ? Math.max(projectedWeight, goal) : Math.min(projectedWeight, goal)

      const weekDate = new Date(today)
      weekDate.setDate(today.getDate() + week * 7)

      forecastData.push({
        period: week,
        week,
        weight: Number.parseFloat(finalWeight.toFixed(1)),
        bmi: Number.parseFloat(calculateBMI(finalWeight, height).toFixed(1)),
        date: weekDate.toLocaleDateString("en-US", { day: "numeric" }),
        month: weekDate.toLocaleDateString("en-US", { month: "short" }),
        fullDate: weekDate,
      })
    }

    setForecast(forecastData)
    setViewMode("weekly")
    setStats({
      weeklyChange: Math.abs(signedWeeklyChange),
      totalWeeks,
      currentBMI: Number.parseFloat(calculateBMI(current, height).toFixed(1)),
      goalBMI: Number.parseFloat(calculateBMI(goal, height).toFixed(1)),
      isWeightLoss,
      safeWeeklyMin,
      safeWeeklyMax,
    })
  }

  // Generate daily data from weekly forecast (linear interpolation)
  const getDailyForecast = (): ForecastData[] => {
    if (forecast.length < 2 || !stats) return []
    
    const dailyData: ForecastData[] = []
    const height = getHeightValue()
    const current = Number.parseFloat(currentWeight)
    const goal = Number.parseFloat(goalWeight)
    const dailyChange = (stats.isWeightLoss ? -stats.weeklyChange : stats.weeklyChange) / 7
    const totalDays = stats.totalWeeks * 7
    const today = new Date()

    for (let day = 0; day <= totalDays; day++) {
      const projectedWeight = current + dailyChange * day
      const finalWeight = stats.isWeightLoss 
        ? Math.max(projectedWeight, goal) 
        : Math.min(projectedWeight, goal)

      const dayDate = new Date(today)
      dayDate.setDate(today.getDate() + day)

      dailyData.push({
        period: day,
        day,
        weight: Number.parseFloat(finalWeight.toFixed(1)),
        bmi: Number.parseFloat(calculateBMI(finalWeight, height).toFixed(1)),
        date: dayDate.toLocaleDateString("en-US", { day: "numeric" }),
        month: dayDate.toLocaleDateString("en-US", { month: "short" }),
        fullDate: dayDate,
      })
    }

    return dailyData
  }

  // Generate monthly data from weekly forecast
  const getMonthlyForecast = (): ForecastData[] => {
    if (forecast.length < 2 || !stats) return []
    
    const monthlyData: ForecastData[] = []
    const height = getHeightValue()
    const current = Number.parseFloat(currentWeight)
    const goal = Number.parseFloat(goalWeight)
    const weeksPerMonth = 4.33
    const monthlyChange = (stats.isWeightLoss ? -stats.weeklyChange : stats.weeklyChange) * weeksPerMonth
    const totalMonths = Math.ceil(stats.totalWeeks / weeksPerMonth)
    const today = new Date()

    for (let monthNum = 0; monthNum <= totalMonths; monthNum++) {
      const projectedWeight = current + monthlyChange * monthNum
      const finalWeight = stats.isWeightLoss 
        ? Math.max(projectedWeight, goal) 
        : Math.min(projectedWeight, goal)

      const monthDate = new Date(today)
      monthDate.setMonth(today.getMonth() + monthNum)

      monthlyData.push({
        period: monthNum,
        monthNum,
        weight: Number.parseFloat(finalWeight.toFixed(1)),
        bmi: Number.parseFloat(calculateBMI(finalWeight, height).toFixed(1)),
        date: monthDate.toLocaleDateString("en-US", { day: "numeric" }),
        month: monthDate.toLocaleDateString("en-US", { month: "short" }),
        fullDate: monthDate,
      })
    }

    return monthlyData
  }

  // Get the forecast data based on current view mode
  const getDisplayForecast = (): ForecastData[] => {
    switch (viewMode) {
      case "daily":
        return getDailyForecast()
      case "monthly":
        return getMonthlyForecast()
      case "weekly":
      default:
        return forecast
    }
  }

  const displayForecast = getDisplayForecast()

  const getBMICategory = (bmi: number): { label: string; color: string } => {
    if (bmi < 18.5) return { label: "Underweight", color: "text-blue-600" }
    if (bmi < 25) return { label: "Normal", color: "text-green-600" }
    if (bmi < 30) return { label: "Overweight", color: "text-yellow-600" }
    return { label: "Obese", color: "text-red-600" }
  }

  const exportTableAsPNG = async () => {
    if (!tableRef.current) return

    try {
      const dataUrl = await toPng(tableRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
      })

      const link = document.createElement("a")
      link.download = `weight-forecast-${new Date().toLocaleDateString("en-US").replace(/\//g, "-")}.png`
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error("Error exporting table:", error)
      alert("Failed to export table. Please try again.")
    }
  }

  return (
    <>
    <div className="grid gap-6 md:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Your Information
          </CardTitle>
          <CardDescription>Enter your current stats and weight goal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="height">Height</Label>
            <div className="flex gap-2">
              {heightUnit === "ft" ? (
                <>
                  <Input
                    id="height-feet"
                    type="number"
                    placeholder="5"
                    value={heightFeet}
                    onChange={(e) => setHeightFeet(e.target.value)}
                    step="1"
                    min="0"
                    className="flex-1"
                  />
                  <span className="flex items-center text-sm text-muted-foreground">ft</span>
                  <Input
                    id="height-inches"
                    type="number"
                    placeholder="9"
                    value={heightInches}
                    onChange={(e) => setHeightInches(e.target.value)}
                    step="1"
                    min="0"
                    max="11"
                    className="flex-1"
                  />
                  <span className="flex items-center text-sm text-muted-foreground">in</span>
                </>
              ) : (
                <Input
                  id="height-cm"
                  type="number"
                  placeholder="170"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  step="1"
                  className="flex-1"
                />
              )}
              <Select value={heightUnit} onValueChange={(value: HeightUnit) => setHeightUnit(value)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cm">cm</SelectItem>
                  <SelectItem value="ft">ft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="current-weight">Current Weight</Label>
            <div className="flex gap-2">
              <Input
                id="current-weight"
                type="number"
                placeholder={weightUnit === "kg" ? "70" : "154"}
                value={currentWeight}
                onChange={(e) => setCurrentWeight(e.target.value)}
                step="0.1"
                className="flex-1"
              />
              <Select value={weightUnit} onValueChange={(value: WeightUnit) => setWeightUnit(value)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="lbs">lbs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {recommendedWeight && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Healthy Weight Range</AlertTitle>
              <AlertDescription>
                Based on a healthy BMI (18.5-24.9), your recommended weight range is{" "}
                <span className="font-semibold">
                  {recommendedWeight.min}-{recommendedWeight.max} {weightUnit}
                </span>
                . You can adjust your goal as needed.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="goal-weight">Goal Weight</Label>
            <div className="flex items-center gap-2">
              <Input
                id="goal-weight"
                type="number"
                placeholder={weightUnit === "kg" ? "65" : "143"}
                value={goalWeight}
                onChange={(e) => setGoalWeight(e.target.value)}
                step="0.1"
                className="flex-1"
              />
              {goalBMI !== null && (
                <div className="flex items-center gap-1 whitespace-nowrap text-sm">
                  <span className="text-muted-foreground">BMI:</span>
                  <span className={`font-semibold ${getBMICategory(goalBMI).color}`}>
                    {goalBMI} <span className="text-xs">({getBMICategory(goalBMI).label})</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="weekly-change">Weekly Weight Change (Optional)</Label>
            <div className="flex gap-2">
              <Input
                id="weekly-change"
                type="number"
                placeholder={`Default: Safe range used`}
                value={customWeeklyChange}
                onChange={(e) => setCustomWeeklyChange(e.target.value)}
                step="0.1"
                min="0"
                className="flex-1"
              />
              <span className="flex items-center text-sm text-muted-foreground">{weightUnit}/week</span>
            </div>
            <p className="text-xs text-muted-foreground">
              💡 Safe range: {weightUnit === "kg" ? "0.5-1.0 kg" : "1.0-2.0 lbs"}/week for weight loss, {weightUnit === "kg" ? "0.25-0.5 kg" : "0.5-1.0 lbs"}/week for weight gain
            </p>
          </div>

          <Button onClick={generateForecast} className="w-full" size="lg">
            Generate Forecast
          </Button>

          {stats && (
            <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/50 p-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Weekly Change</p>
                <p className="flex items-center gap-1 text-lg font-semibold">
                  {stats.isWeightLoss ? (
                    <TrendingDown className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                  )}
                  {stats.weeklyChange.toFixed(1)} {weightUnit}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Timeline</p>
                <p className="flex items-center gap-1 text-lg font-semibold">
                  <Calendar className="h-4 w-4 text-primary" />
                  {stats.totalWeeks} weeks
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Current BMI</p>
                <p className="text-lg font-semibold">
                  {stats.currentBMI}{" "}
                  <span className={`text-sm font-normal ${getBMICategory(stats.currentBMI).color}`}>
                    {getBMICategory(stats.currentBMI).label}
                  </span>
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Goal BMI</p>
                <p className="text-lg font-semibold">
                  {stats.goalBMI}{" "}
                  <span className={`text-sm font-normal ${getBMICategory(stats.goalBMI).color}`}>
                    {getBMICategory(stats.goalBMI).label}
                  </span>
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Info className="h-4 w-4" />
              BMI Categories
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-600 font-medium">Underweight</span>
                <span className="text-muted-foreground">&lt; 18.5</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-600 font-medium">Normal</span>
                <span className="text-muted-foreground">18.5 - 24.9</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-yellow-600 font-medium">Overweight</span>
                <span className="text-muted-foreground">25 - 29.9</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-red-600 font-medium">Obese</span>
                <span className="text-muted-foreground">&ge; 30</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Weight Forecast
          </CardTitle>
          <CardDescription>
            {forecast.length > 0
              ? `Your projected weight journey over ${stats?.totalWeeks} weeks`
              : "Enter your information to see your forecast"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {forecast.length > 0 ? (
            <div className="h-[500px]">
              <Line
                  data={{
                    labels: forecast.map((d) => `W${d.week} ${d.date} ${d.month}`),
                    datasets: [
                      {
                        label: `Weight (${weightUnit})`,
                        data: forecast.map((d) => d.weight),
                        borderColor: "rgb(99, 102, 241)",
                        borderWidth: 3,
                        pointRadius: 4,
                        pointBackgroundColor: "rgb(99, 102, 241)",
                        tension: 0.3,
                        fill: false,
                        yAxisID: "y",
                      },
                      {
                        label: "BMI",
                        data: forecast.map((d) => d.bmi),
                        borderColor: "rgb(168, 85, 247)",
                        borderWidth: 3,
                        pointRadius: 4,
                        pointBackgroundColor: "rgb(168, 85, 247)",
                        tension: 0.3,
                        fill: false,
                        yAxisID: "y1",
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                      mode: "index",
                      intersect: false,
                    },
                    plugins: {
                      legend: {
                        position: "top",
                        labels: {
                          usePointStyle: true,
                          padding: 20,
                        },
                      },
                      tooltip: {
                        backgroundColor: "rgba(255, 255, 255, 0.95)",
                        titleColor: "#1f2937",
                        bodyColor: "#4b5563",
                        borderColor: "#e5e7eb",
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                          label: (context) => {
                            const label = context.dataset.label || "";
                            const value = context.parsed.y;
                            if (label.includes("Weight")) {
                              return `${label}: ${value} ${weightUnit}`;
                            }
                            return `${label}: ${value}`;
                          },
                        },
                      },
                      annotation: {
                        annotations: {
                          underweightZone: {
                            type: "box",
                            yScaleID: "y1",
                            yMin: 12,
                            yMax: 18.5,
                            backgroundColor: "rgba(59, 130, 246, 0.08)",
                            borderWidth: 0,
                          },
                          normalZone: {
                            type: "box",
                            yScaleID: "y1",
                            yMin: 18.5,
                            yMax: 24.9,
                            backgroundColor: "rgba(34, 197, 94, 0.08)",
                            borderWidth: 0,
                          },
                          overweightZone: {
                            type: "box",
                            yScaleID: "y1",
                            yMin: 24.9,
                            yMax: 30,
                            backgroundColor: "rgba(234, 179, 8, 0.08)",
                            borderWidth: 0,
                          },
                          obeseZone: {
                            type: "box",
                            yScaleID: "y1",
                            yMin: 30,
                            yMax: 40,
                            backgroundColor: "rgba(239, 68, 68, 0.08)",
                            borderWidth: 0,
                          },
                        },
                      },
                    },
                    scales: {
                      x: {
                        grid: {
                          display: false,
                        },
                        ticks: {
                          maxRotation: 45,
                          minRotation: 45,
                        },
                      },
                      y: {
                        type: "linear",
                        display: true,
                        position: "left",
                        min: 40,
                        max: 100,
                        title: {
                          display: true,
                          text: `Weight (${weightUnit})`,
                        },
                        grid: {
                          color: "rgba(0, 0, 0, 0.05)",
                        },
                      },
                      y1: {
                        type: "linear",
                        display: true,
                        position: "right",
                        min: 12,
                        max: 40,
                        title: {
                          display: true,
                          text: "BMI",
                        },
                        grid: {
                          drawOnChartArea: false,
                        },
                      },
                    },
                  }}
                />
            </div>
          ) : (
            <div className="flex h-[500px] items-center justify-center rounded-lg border border-dashed">
              <div className="text-center">
                <Activity className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">Your weight forecast will appear here</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>

    {/* Forecast Table - Outside Card for full expansion and better PNG export */}
    {forecast.length > 0 && (
      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold">Forecast Data</h3>
          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={(value: ViewMode) => setViewMode(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={exportTableAsPNG} variant="outline" size="sm" className="gap-2 bg-transparent">
              <Download className="h-4 w-4" />
              Export as PNG
            </Button>
          </div>
        </div>

        <div 
          ref={tableRef} 
          data-export="true"
          className="rounded-lg border bg-white p-6"
          style={{ backgroundColor: "#ffffff" }}
        >
          <div className="mb-4">
            <h4 className="text-base font-semibold" style={{ color: "#1f2937", fontWeight: 600 }}>
              Weight {stats?.isWeightLoss ? "Loss" : "Gain"} Forecast ({viewMode.charAt(0).toUpperCase() + viewMode.slice(1)})
            </h4>
            <p className="text-sm" style={{ color: "#6b7280" }}>
              Generated on{" "}
              {new Date().toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24" style={{ color: "#374151" }}>
                  {viewMode === "daily" ? "Day" : viewMode === "monthly" ? "Month" : "Week"}
                </TableHead>
                <TableHead style={{ color: "#374151" }}>Date</TableHead>
                <TableHead className="text-right" style={{ color: "#374151" }}>Weight ({weightUnit})</TableHead>
                <TableHead className="text-right" style={{ color: "#374151" }}>BMI</TableHead>
                <TableHead style={{ color: "#374151" }}>BMI Category</TableHead>
                <TableHead className="text-right" style={{ color: "#374151" }}>Change ({weightUnit})</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayForecast.map((data, index) => {
                const weightChange =
                  index === 0 ? 0 : Number.parseFloat((data.weight - displayForecast[index - 1].weight).toFixed(1))
                
                const getBMICategoryStyle = (bmi: number) => {
                  if (bmi < 18.5) return { color: "#2563eb" }
                  if (bmi < 25) return { color: "#16a34a" }
                  if (bmi < 30) return { color: "#ca8a04" }
                  return { color: "#dc2626" }
                }

                const getPeriodLabel = () => {
                  if (viewMode === "daily") return `Day ${data.period}`
                  if (viewMode === "monthly") return `Month ${data.period}`
                  return `Week ${data.period}`
                }

                return (
                  <TableRow key={data.period}>
                    <TableCell className="font-medium" style={{ color: "#1f2937" }}>{getPeriodLabel()}</TableCell>
                    <TableCell style={{ color: "#374151" }}>
                      {data.fullDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right font-medium" style={{ color: "#1f2937" }}>{data.weight}</TableCell>
                    <TableCell className="text-right" style={{ color: "#374151" }}>{data.bmi}</TableCell>
                    <TableCell>
                      <span 
                        className="text-sm font-medium"
                        style={getBMICategoryStyle(data.bmi)}
                      >
                        {getBMICategory(data.bmi).label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {index === 0 ? (
                        <span style={{ color: "#6b7280" }}>-</span>
                      ) : (
                        <span style={{ color: weightChange < 0 ? "#16a34a" : "#2563eb" }}>
                          {weightChange > 0 ? "+" : ""}
                          {weightChange}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    )}
  </>
  )
}
