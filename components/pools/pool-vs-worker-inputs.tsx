"use client";

// TODO find a better way to do this
// import { useDebounceValue } from 'usehooks-ts'
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

type Props = {
  onDaysChange: (days: number) => void;
  onStartingAmountChange: (amount: number) => void;
  initialDays?: number;
  initialStartingAmount?: number;
  disableInputs: boolean;
};

export default function PoolWorkerInputs({
  onDaysChange,
  onStartingAmountChange,
  initialDays = 30,
  initialStartingAmount = 50,
  disableInputs,
}: Props) {
  const [days, setDays] = useState(initialDays);
  const [startingAmount, setStartingAmount] = useState(initialStartingAmount);

  const handleDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDays = Number(e.target.value);
    setDays(newDays);
    onDaysChange(newDays);
  };

  const handleStartingAmountChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newAmount = Number(e.target.value);
    setStartingAmount(newAmount);
    onStartingAmountChange(newAmount);
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="days">Number of Days (1-200 days)</Label>
        <Input
          disabled={disableInputs}
          id="days"
          type="number"
          min={1}
          max={200}
          step={1}
          placeholder="30"
          value={days}
          onChange={handleDaysChange}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="startingAmount">Starting Amount (0-40000 SATORI)</Label>
        <Input
          disabled={disableInputs}
          id="startingAmount"
          type="number"
          min={0}
          max={40000}
          step={0.00000001}
          placeholder="0.00000001"
          value={startingAmount}
          onChange={handleStartingAmountChange}
        />
      </div>
    </div>
  );
}
