"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { Activity, Target, TrendingDown, TrendingUp, Calendar, Info, Download } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import html2canvas from "html2canvas"

type WeightUnit = "kg" | "lbs"
type HeightUnit = "cm" | "ft"

interface ForecastData {
  week: number
  weight: number
  bmi: number
  date: string
  month: string
}

export default function WeightTracker() {
  const [heightFeet, setHeightFeet] = useState("")
  const [heightInches, setHeightInches] = useState("")
  const [heightCm, setHeightCm] = useState("")
  const [heightUnit, setHeightUnit] = useState<HeightUnit>("cm")
  const [currentWeight, setCurrentWeight] = useState("")
  const [goalWeight, setGoalWeight] = useState("")
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kg")
  const [customWeeklyChange, setCustomWeeklyChange] = useState("")
  const [forecast, setForecast] = useState<ForecastData[]>([])
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
        week,
        weight: Number.parseFloat(finalWeight.toFixed(1)),
        bmi: Number.parseFloat(calculateBMI(finalWeight, height).toFixed(1)),
        date: weekDate.toLocaleDateString("en-US", { day: "numeric" }),
        month: weekDate.toLocaleDateString("en-US", { month: "short" }),
      })
    }

    setForecast(forecastData)
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

  const getBMICategory = (bmi: number): { label: string; color: string } => {
    if (bmi < 18.5) return { label: "Underweight", color: "text-blue-600" }
    if (bmi < 25) return { label: "Normal", color: "text-green-600" }
    if (bmi < 30) return { label: "Overweight", color: "text-yellow-600" }
    return { label: "Obese", color: "text-red-600" }
  }

  const exportTableAsPNG = async () => {
    if (!tableRef.current) return

    try {
      const canvas = await html2canvas(tableRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      })

      const link = document.createElement("a")
      link.download = `weight-forecast-${new Date().toLocaleDateString("en-US").replace(/\//g, "-")}.png`
      link.href = canvas.toDataURL()
      link.click()
    } catch (error) {
      console.error("Error exporting table:", error)
      alert("Failed to export table. Please try again.")
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[400px_1fr]">
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
            {stats && (
              <p className="text-sm text-muted-foreground">
                Healthy range: {stats.safeWeeklyMin}-{stats.safeWeeklyMax} {weightUnit}/week
              </p>
            )}
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
            <div className="space-y-6">
              <ChartContainer
                config={{
                  weight: {
                    label: `Weight (${weightUnit})`,
                    color: "hsl(var(--chart-1))",
                  },
                  bmi: {
                    label: "BMI",
                    color: "hsl(var(--chart-2))",
                  },
                }}
                className="h-[500px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecast} margin={{ top: 5, right: 30, left: 10, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="week"
                      className="text-xs"
                      tickFormatter={(value, index) => {
                        const data = forecast[index]
                        return data ? `W${value} ${data.date} ${data.month}` : `W${value}`
                      }}
                      angle={-60}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis
                      yAxisId="left"
                      label={{ value: `Weight (${weightUnit})`, angle: -90, position: "insideLeft" }}
                      className="text-xs"
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      label={{ value: "BMI", angle: 90, position: "insideRight" }}
                      className="text-xs"
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload) return null
                        return (
                          <div className="rounded-lg border bg-card p-3 shadow-lg">
                            <p className="mb-2 text-sm font-semibold">
                              Week {payload[0]?.payload.week} - {payload[0]?.payload.date} {payload[0]?.payload.month}
                            </p>
                            <div className="space-y-1">
                              <p className="flex items-center gap-2 text-sm">
                                <span className="h-2 w-2 rounded-full bg-[hsl(var(--chart-1))]" />
                                Weight:{" "}
                                <span className="font-semibold">
                                  {payload[0]?.value} {weightUnit}
                                </span>
                              </p>
                              <p className="flex items-center gap-2 text-sm">
                                <span className="h-2 w-2 rounded-full bg-[hsl(var(--chart-2))]" />
                                BMI: <span className="font-semibold">{payload[1]?.value}</span>
                              </p>
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="weight"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={3}
                      dot={{ fill: "hsl(var(--chart-1))", r: 4 }}
                      name={`Weight (${weightUnit})`}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="bmi"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={3}
                      dot={{ fill: "hsl(var(--chart-2))", r: 4 }}
                      name="BMI"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Forecast Data</h3>
                  <Button onClick={exportTableAsPNG} variant="outline" size="sm" className="gap-2 bg-transparent">
                    <Download className="h-4 w-4" />
                    Export as PNG
                  </Button>
                </div>

                <div ref={tableRef} className="rounded-lg border bg-card p-4">
                  <div className="mb-4">
                    <h4 className="text-base font-semibold">Weight Loss Forecast</h4>
                    <p className="text-sm text-muted-foreground">
                      Generated on{" "}
                      {new Date().toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Week</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Weight ({weightUnit})</TableHead>
                          <TableHead className="text-right">BMI</TableHead>
                          <TableHead>BMI Category</TableHead>
                          <TableHead className="text-right">Change ({weightUnit})</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {forecast.map((data, index) => {
                          const weightChange =
                            index === 0 ? 0 : Number.parseFloat((data.weight - forecast[index - 1].weight).toFixed(1))
                          const fullDate = new Date()
                          fullDate.setDate(fullDate.getDate() + data.week * 7)

                          return (
                            <TableRow key={data.week}>
                              <TableCell className="font-medium">Week {data.week}</TableCell>
                              <TableCell>
                                {fullDate.toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </TableCell>
                              <TableCell className="text-right font-medium">{data.weight}</TableCell>
                              <TableCell className="text-right">{data.bmi}</TableCell>
                              <TableCell>
                                <span className={`text-sm font-medium ${getBMICategory(data.bmi).color}`}>
                                  {getBMICategory(data.bmi).label}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                {index === 0 ? (
                                  <span className="text-muted-foreground">-</span>
                                ) : (
                                  <span className={weightChange < 0 ? "text-green-600" : "text-blue-600"}>
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
              </div>
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
  )
}
