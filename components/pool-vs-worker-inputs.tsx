'use client';

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  onDaysChange: (days: number) => void;
  onStartingAmountChange: (amount: number) => void;
  initialDays?: number;
  initialStartingAmount?: number;
};

export default function PoolWorkerInputs({ 
  onDaysChange, 
  onStartingAmountChange,
  initialDays = 30,
  initialStartingAmount = 15 
}: Props) {
  const [days, setDays] = useState(initialDays);
  const [startingAmount, setStartingAmount] = useState(initialStartingAmount);

  const handleDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDays = Number(e.target.value);
    setDays(newDays);
    onDaysChange(newDays);
  };

  const handleStartingAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAmount = Number(e.target.value);
    setStartingAmount(newAmount);
    onStartingAmountChange(newAmount);
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="days">Number of Days</Label>
        <Input
          id="days"
          type="number"
          min={1}
          max={100}
          value={days}
          onChange={handleDaysChange}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="startingAmount">Starting Amount (SATORI)</Label>
        <Input
          id="startingAmount"
          type="number"
          min={0}
          max={40000}
          value={startingAmount}
          onChange={handleStartingAmountChange}
        />
      </div>
    </div>
  );
} 