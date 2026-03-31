import { useState } from "react";
import "./App.css";
import MineSweeper from "./components/MineSweeper";
import Timer from "./components/Timer";

function App() {
  return <MineSweeper difficulty={0} />;
}

export default App;
