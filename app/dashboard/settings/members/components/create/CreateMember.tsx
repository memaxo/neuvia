import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import CreateForm from './CreateForm'

export default function CreateMember() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-orange-600 text-white hover:bg-orange-500">
          <UserPlus className="mr-2 h-5 w-5" />
          Add Member
        </Button>
      </DialogTrigger>
      <DialogContent className="border-teal-700 bg-teal-900">
        <DialogHeader>
          <DialogTitle className="text-teal-100">
            Add New Team Member
          </DialogTitle>
        </DialogHeader>
        <CreateForm />
      </DialogContent>
    </Dialog>
  )
}
