import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { UserPlus } from "lucide-react"
import CreateForm from "./CreateForm"

export default function CreateMember() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-orange-600 hover:bg-orange-500 text-white">
          <UserPlus className="h-5 w-5 mr-2" />
          Add Member
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-teal-900 border-teal-700">
        <DialogHeader>
          <DialogTitle className="text-teal-100">Add New Team Member</DialogTitle>
        </DialogHeader>
        <CreateForm />
      </DialogContent>
    </Dialog>
  )
} 